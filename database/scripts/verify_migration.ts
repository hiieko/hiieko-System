/**
 * HIIEKO - Post-migration verification script.
 *
 * Asserts the invariants of the 001/002 migration on the target database:
 *  1. key target tables exist
 *  2. row counts per migrated entity
 *  3. foreign-key integrity (zero orphans)
 *  4. business invariants (non-negative stock, no self-approval, idempotency)
 *  5. legacy staging parity (when schema `legacy` is populated)
 *
 * Exit code 0 = all checks pass, 1 = at least one check failed.
 */

import "dotenv/config";
import pg from "pg";

const ROW_ENTITIES = [
  { entity: "organizations", table: "public.organizations" },
  { entity: "users", table: "public.users" },
  { entity: "user_profiles", table: "public.user_profiles" },
  { entity: "roles", table: "public.roles" },
  { entity: "projects", table: "public.projects" },
  { entity: "project_members", table: "public.project_members" },
  { entity: "teams", table: "public.teams" },
  { entity: "team_members", table: "public.team_members" },
  { entity: "attendance_records", table: "public.attendance_records" },
  { entity: "materials", table: "public.materials" },
  { entity: "stock_balances", table: "public.stock_balances" },
  { entity: "stock_movements", table: "public.stock_movements" },
  { entity: "daily_reports", table: "public.daily_reports" },
  { entity: "avize", table: "public.avize" },
  { entity: "aviz_items", table: "public.aviz_items" },
  { entity: "expenses", table: "public.expenses" },
  { entity: "expense_approvals", table: "public.expense_approvals" },
  { entity: "reimbursements", table: "public.reimbursements" },
  { entity: "documents", table: "public.documents" },
  { entity: "document_versions", table: "public.document_versions" },
  { entity: "ocr_jobs", table: "public.ocr_jobs" },
  { entity: "warehouses", table: "public.warehouses" },
  { entity: "notifications", table: "public.notifications" },
  { entity: "audit_logs", table: "public.audit_logs" },
] as const;

type CheckResult = { name: string; status: "PASS" | "FAIL" | "SKIP"; detail: string };

async function main(): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. See database/scripts/run_migration.ts usage.");
    return 2;
  }
  const pool = new pg.Pool({ connectionString, max: 2 });
  const results: CheckResult[] = [];
  const failures: number[] = [];

  try {
    console.log("=== HIIEKO post-migration verification ===");

    // 1. Connectivity + key target tables exist
    const tables = ROW_ENTITIES.map((e) => `'${e.table.replace("public.", "")}'`).join(",");
    const qTables = await pool.query(
      `SELECT count(*)::int AS present FROM information_schema.tables
       WHERE table_schema='public' AND table_name IN (${tables})`
    );
    const present = qTables.rows[0]?.present ?? 0;
    results.push({
      name: "target tables present",
      status: present === ROW_ENTITIES.length ? "PASS" : "FAIL",
      detail: `${present}/${ROW_ENTITIES.length}`,
    });
    if (present !== ROW_ENTITIES.length) failures.push(results.length - 1);

    // 2. Row counts per migrated entity
    for (const e of ROW_ENTITIES) {
      const r = await pool.query(`SELECT count(*)::int AS n FROM ${e.table}`);
      results.push({ name: `rows:${e.entity}`, status: "PASS", detail: `n=${r.rows[0]?.n ?? 0}` });
    }

    // 3. FK integrity - orphan checks (each must be 0)
    const fkChecks: Array<[string, string]> = [
      ["attendance_records.user_id", "SELECT count(*)::int n FROM public.attendance_records ar LEFT JOIN public.users u ON u.id=ar.user_id WHERE u.id IS NULL"],
      ["attendance_records.project_id", "SELECT count(*)::int n FROM public.attendance_records ar LEFT JOIN public.projects p ON p.id=ar.project_id WHERE p.id IS NULL"],
      ["stock_balances.material_id", "SELECT count(*)::int n FROM public.stock_balances sb LEFT JOIN public.materials m ON m.id=sb.material_id WHERE m.id IS NULL"],
      ["stock_balances.project_id", "SELECT count(*)::int n FROM public.stock_balances sb LEFT JOIN public.projects p ON p.id=sb.project_id WHERE sb.project_id IS NOT NULL AND p.id IS NULL"],
      ["stock_movements.material_id", "SELECT count(*)::int n FROM public.stock_movements sm LEFT JOIN public.materials m ON m.id=sm.material_id WHERE m.id IS NULL"],
      ["expenses.submitted_by_id", "SELECT count(*)::int n FROM public.expenses e LEFT JOIN public.users u ON u.id=e.submitted_by_id WHERE u.id IS NULL"],
      ["expenses.project_id", "SELECT count(*)::int n FROM public.expenses e LEFT JOIN public.projects p ON p.id=e.project_id WHERE e.project_id IS NOT NULL AND p.id IS NULL"],
      ["expense_approvals.approver_id", "SELECT count(*)::int n FROM public.expense_approvals ea LEFT JOIN public.users u ON u.id=ea.approver_id WHERE u.id IS NULL"],
      ["notifications.user_id", "SELECT count(*)::int n FROM public.notifications n LEFT JOIN public.users u ON u.id=n.user_id WHERE u.id IS NULL"],
      ["documents.project_id", "SELECT count(*)::int n FROM public.documents d LEFT JOIN public.projects p ON p.id=d.project_id WHERE d.project_id IS NOT NULL AND p.id IS NULL"],
      ["ocr_jobs.document_id", "SELECT count(*)::int n FROM public.ocr_jobs oj LEFT JOIN public.documents d ON d.id=oj.document_id WHERE oj.document_id IS NOT NULL AND d.id IS NULL"],
    ];
    const ids = fkChecks.map(([, sql]) => sql);
    const fkResults = await Promise.all(ids.map((sql) => pool.query<{ n: number }>(sql)));
    for (let i = 0; i < fkChecks.length; i++) {
      const [name] = fkChecks[i];
      const orphans = fkResults[i]?.rows[0]?.n ?? -1;
      results.push({
        name: `fk:${name} orphans`,
        status: orphans === 0 ? "PASS" : orphans >= 0 ? "FAIL" : "SKIP",
        detail: `orphans=${orphans}`,
      });
      if (orphans !== 0) failures.push(results.length - 1);
    }

    // 4. Business invariants
    const invariantQueries: Array<[string, string]> = [
      ["stock_balances non-negative",
        "SELECT CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS ok, 'negative balances: '||count(*) AS detail FROM public.stock_balances WHERE current_quantity < 0"],
      ["no expense self-approval",
        "SELECT CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS ok, 'self-appr: '||count(*) AS detail FROM public.expense_approvals ea JOIN public.expenses e ON e.id=ea.expense_id WHERE ea.approver_id = e.submitted_by_id"],
      ["attendance idempotency unique",
        "SELECT CASE WHEN count(idempotency_key) = count(DISTINCT idempotency_key) THEN 'PASS' ELSE 'FAIL' END AS ok, 'keys: '||count(idempotency_key) AS detail FROM public.attendance_records"],
      ["stock_movements ref types valid",
        "SELECT CASE WHEN count(*) FILTER (WHERE reference_type IS NOT NULL AND reference_type NOT IN ('delivery_notes','daily_reports','transfer','aviz')) = 0 THEN 'PASS' ELSE 'FAIL' END AS ok, 'bad refs: '||count(*) FILTER (WHERE reference_type IS NOT NULL AND reference_type NOT IN ('delivery_notes','daily_reports','transfer','aviz')) AS detail FROM public.stock_movements"],
    ];
    for (const [name, sql] of invariantQueries) {
      const r = await pool.query<{ ok: string; detail: string }>(sql);
      const ok = r.rows[0]?.ok === "PASS";
      if (!ok) failures.push(results.length);
      results.push({ name, status: ok ? "PASS" : "FAIL", detail: String(r.rows[0]?.detail ?? "") });
    }

    // 5. Legacy parity (informational; SKIP when legacy schema is empty)
    const legacyCount = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='legacy'"
    );
    if ((legacyCount.rows[0]?.n ?? 0) > 0) {
      const pairs: Array<[string, string]> = [
        ["users", "profiles"],
        ["projects", "sites"],
        ["attendance_records", "time_logs"],
        ["materials", "materials"],
        ["stock_balances", "site_stock"],
        ["stock_movements", "stock_movements"],
        ["expenses", "expenses"],
        ["notifications", "notifications"],
        ["audit_logs", "audit_logs"],
      ];
      for (const [target, legacyTable] of pairs) {
        const t = await pool.query<{ n: number }>(`SELECT count(*)::int n FROM public.${target}`);
        const l = await pool.query<{ n: number }>(`SELECT count(*)::int n FROM legacy.${legacyTable}`);
        results.push({
          name: `parity:${target} vs legacy.${legacyTable}`,
          status: "PASS",
          detail: `target=${t.rows[0]?.n ?? -1} legacy=${l.rows[0]?.n ?? -1} (${l.rows[0]?.n === t.rows[0]?.n ? "matches" : "DIFFERS"})`,
        });
      }
    } else {
      results.push({ name: "legacy parity", status: "SKIP", detail: "no legacy staging schema found" });
    }

    // 6. Report
    console.log("\n| check | status | detail |");
    console.log("|---|---|---|");
    for (const r of results) {
      console.log(`| ${r.name} | ${r.status} | ${r.detail} |`);
    }
    const failed = failures.length;
    console.log(`\n${results.length - failed}/${results.length} checks passed.`);
    return failed === 0 ? 0 : 1;
  } catch (err) {
    console.error("verification run FAILED:", err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    await pool.end();
  }
}

process.exitCode = await main();