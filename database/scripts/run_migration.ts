/**
 * HIIEKO - Database migration runner.
 *
 * Executes database/migrations/*.sql against the target PostgreSQL database
 * using the `pg` driver. Designed to run on Node >= 24 (native TS type
 * stripping) or any Node with tsx:
 *
 *   node database/scripts/run_migration.ts                # apply 001 + 002
 *   node database/scripts/run_migration.ts --rollback     # apply 003 (rollback)
 *   node database/scripts/run_migration.ts --migration 002   # single file
 *   node database/scripts/run_migration.ts --only-verify  # alias to verify script
 *
 * Connection: DATABASE_URL env var (postgres://user:pass@host:5432/db).
 * Legacy data must be staged in a schema named `legacy` (see 002 header).
 * The runner creates the schema if it is missing and prints guidance.
 */

import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, "..", "migrations");
const FILES = {
  "001": "001_create_target_schema.sql",
  "002": "002_migrate_supabase_data.sql",
  "003": "003_rollback_migration.sql",
};

type Options = {
  rollback: boolean;
  migration: string | undefined;
};

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const has = (flag: string) => args.includes(flag);
  let migration: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--migration" || args[i] === "-m") {
      migration = args[i + 1];
    }
  }
  return {
    rollback: has("--rollback") || has("-r") || has("down"),
    migration,
  };
}

async function describeDatabase(client: pg.Client): Promise<void> {
  const row = await client.query<{ version: string }>("SELECT version() AS version");
  console.log(`  server: ${row.rows[0]?.version ?? "unknown"}`);
  const s = await client.query<{ n: string }>(
    "SELECT schema_name AS n FROM information_schema.schemata WHERE schema_name IN ('public','legacy') ORDER BY 1"
  );
  console.log(`  schemas: ${s.rows.map((r) => r.n).join(", ") || "(none)"}`);
}

async function prepLegacySchema(client: pg.Client): Promise<void> {
  const exists = await client.query<{ n: string }>(
    "SELECT 1 AS n FROM information_schema.schemata WHERE schema_name = 'legacy'"
  );
  if (exists.rowCount && exists.rowCount > 0) {
    console.log("  legacy staging schema present              [ok]");
    return;
  }
  await client.query("CREATE SCHEMA IF NOT EXISTS legacy;");
  console.log(
    "  legacy staging schema created (empty)      [note]\n" +
      "    Stage the Supabase dump into this schema, e.g:\n" +
      "      pg_restore --schema=legacy -d <target-db> <supabase-dump>\n" +
      "    or apply database/archive/supabase-migrations/full_setup.sql with search_path=legacy."
  );
}

async function ensureFile(path: string, label: string): Promise<string> {
  try {
    await stat(path);
  } catch {
    throw new Error(`${label} not found: ${path}`);
  }
  return await readFile(path, "utf8");
}

async function runSql(
  client: pg.Client,
  sql: string,
  label: string,
  options: { captureNotices: boolean }
): Promise<void> {
  const started = Date.now();
  const onNotice = (n: { message: string }) => {
    if (options.captureNotices && n.message) console.log(`      < $ ${n.message.trim()}`);
  };
  client.on("notice", onNotice);
  try {
    await client.query(sql);
  } finally {
    client.off("notice", onNotice);
  }
  console.log(`  applied ${label}  (${Date.now() - started} ms)`);
}

async function run(): Promise<number> {
  const opts = parseArgs(process.argv);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Provide it via .env or environment, e.g.:\n" +
        "  DATABASE_URL=postgres://postgres:postgres@localhost:5432/hiieko node database/scripts/run_migration.ts"
    );
    return 2;
  }

  const pool = new pg.Pool({ connectionString, max: 1, idleTimeoutMillis: 30_000 });
  pool.on("error", (err) => console.error("  [pool] error:", err.message));

  try {
    console.log("=== HIIEKO database migration runner ===");
    await describeDatabase(await pool.connect());
    await prepLegacySchema(await pool.connect());

    let targets: string[] = [];
    if (opts.rollback) {
      targets = ["003"];
    } else if (opts.migration) {
      const key = opts.migration.length === 3 ? opts.migration : opts.migration.padStart(3, "0");
      if (!FILES[key]) throw new Error(`unknown migration "${opts.migration}" (expected 001|002|003)`);
      targets = [key];
    } else {
      targets = ["001", "002"];
    }

    const client = await pool.connect();
    for (const key of targets) {
      const file = join(MIGRATIONS_DIR, FILES[key]!);
      console.log(`\n-- ${key}: ${FILES[key]} --`);
      const sql = await ensureFile(file, `migration ${key}`);
      // 002's NOTICEs carry ETL progress counters - surface them.
      await runSql(client, sql, `${key} ${FILES[key]} (${sql.length.toLocaleString()} chars)`, {
        captureNotices: key !== "001",
      });
    }
    await client.release();
    console.log("\n=== migration run complete ===");
    return 0;
  } catch (err) {
    console.error("\n=== migration run FAILED ===");
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

process.exitCode = await run();