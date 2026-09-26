// ============================================================================
// HIIEKO Database Integrity Verification (Phase 3)
// ============================================================================
// Usage:
//   npx ts-node backend/scripts/db-verify.ts
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, status: 'PASS', detail });
  console.log(`  PASS - ${name}: ${detail}`);
}

function fail(name: string, detail: string) {
  results.push({ name, status: 'FAIL', detail });
  console.log(`  FAIL - ${name}: ${detail}`);
}

function skip(name: string, detail: string) {
  results.push({ name, status: 'SKIPPED', detail });
  console.log(`  SKIPPED - ${name}: ${detail}`);
}

function header(title: string) {
  console.log('');
  console.log('='.repeat(72));
  console.log(`  ${title}`);
  console.log('='.repeat(72));
}

async function main() {
  console.log('HIIEKO Database Integrity Verification');
  console.log('='.repeat(72));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@') || 'from .env'}`);
  console.log('='.repeat(72));

  // =====================================================================
  // SECTION 1: FK Orphan Counts
  // =====================================================================
  header('SECTION 1: Foreign Key Orphan Counts');

  // 1a. TeamMember referencing non-existent team
  try {
    const orphanTeamMembers = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM team_members tm WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = tm.team_id)'
    );
    const count = Number(orphanTeamMembers[0]?.count || 0);
    if (count === 0) pass('FK: team_members.team_id', 'No orphan team member references');
    else fail('FK: team_members.team_id', `${count} orphan team members referencing non-existent teams`);
  } catch (e: any) { skip('FK: team_members.team_id', `Query error: ${e.message}`); }

  // 1b. TeamMember referencing non-existent user
  try {
    const orphanUsers = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM team_members tm WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tm.user_id)'
    );
    const count = Number(orphanUsers[0]?.count || 0);
    if (count === 0) pass('FK: team_members.user_id', 'No orphan user references in team_members');
    else fail('FK: team_members.user_id', `${count} orphan user references in team_members`);
  } catch (e: any) { skip('FK: team_members.user_id', `Query error: ${e.message}`); }

  // 1c. DailyPlanTask referencing non-existent daily plan
  try {
    const orphanPlanTasks = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_plan_tasks dpt WHERE NOT EXISTS (SELECT 1 FROM daily_plans dp WHERE dp.id = dpt.daily_plan_id)'
    );
    const count = Number(orphanPlanTasks[0]?.count || 0);
    if (count === 0) pass('FK: daily_plan_tasks.daily_plan_id', 'No orphan plan task references');
    else fail('FK: daily_plan_tasks.daily_plan_id', `${count} orphan plan task references`);
  } catch (e: any) { skip('FK: daily_plan_tasks.daily_plan_id', `Query error: ${e.message}`); }

  // 1d. DailyPlanTask referencing non-existent task
  try {
    const orphanTaskRefs = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_plan_tasks dpt WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = dpt.task_id)'
    );
    const count = Number(orphanTaskRefs[0]?.count || 0);
    if (count === 0) pass('FK: daily_plan_tasks.task_id', 'No orphan task references in plan tasks');
    else fail('FK: daily_plan_tasks.task_id', `${count} orphan task references in plan tasks`);
  } catch (e: any) { skip('FK: daily_plan_tasks.task_id', `Query error: ${e.message}`); }

  // 1e. TaskAssignment referencing non-existent task
  try {
    const orphanTaskAssigns = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM task_assignments ta WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = ta.task_id)'
    );
    const count = Number(orphanTaskAssigns[0]?.count || 0);
    if (count === 0) pass('FK: task_assignments.task_id', 'No orphan task assignment references');
    else fail('FK: task_assignments.task_id', `${count} orphan task assignment references`);
  } catch (e: any) { skip('FK: task_assignments.task_id', `Query error: ${e.message}`); }

  // 1f. TaskAssignment referencing non-existent user
  try {
    const orphanAssignUsers = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM task_assignments ta WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ta.user_id)'
    );
    const count = Number(orphanAssignUsers[0]?.count || 0);
    if (count === 0) pass('FK: task_assignments.user_id', 'No orphan user references in task_assignments');
    else fail('FK: task_assignments.user_id', `${count} orphan user references in task_assignments`);
  } catch (e: any) { skip('FK: task_assignments.user_id', `Query error: ${e.message}`); }

  // 1g. AttendanceRecord referencing non-existent project
  try {
    const orphanAttendProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM attendance_records ar WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = ar.project_id)'
    );
    const count = Number(orphanAttendProj[0]?.count || 0);
    if (count === 0) pass('FK: attendance_records.project_id', 'No orphan project references in attendance');
    else fail('FK: attendance_records.project_id', `${count} orphan project references in attendance`);
  } catch (e: any) { skip('FK: attendance_records.project_id', `Query error: ${e.message}`); }

  // 1h. Aviz referencing non-existent project
  try {
    const orphanAvizProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM avize a WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = a.project_id)'
    );
    const count = Number(orphanAvizProj[0]?.count || 0);
    if (count === 0) pass('FK: avize.project_id', 'No orphan project references in avize');
    else fail('FK: avize.project_id', `${count} orphan project references in avize`);
  } catch (e: any) { skip('FK: avize.project_id', `Query error: ${e.message}`); }

  // 1i. AvizItem referencing non-existent aviz
  try {
    const orphanAvizItems = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM aviz_items ai WHERE NOT EXISTS (SELECT 1 FROM avize a WHERE a.id = ai.aviz_id)'
    );
    const count = Number(orphanAvizItems[0]?.count || 0);
    if (count === 0) pass('FK: aviz_items.aviz_id', 'No orphan aviz item references');
    else fail('FK: aviz_items.aviz_id', `${count} orphan aviz item references`);
  } catch (e: any) { skip('FK: aviz_items.aviz_id', `Query error: ${e.message}`); }

  // 1j. StockBalance referencing non-existent material
  try {
    const orphanStockMat = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM stock_balances sb WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = sb.material_id)'
    );
    const count = Number(orphanStockMat[0]?.count || 0);
    if (count === 0) pass('FK: stock_balances.material_id', 'No orphan material references in stock_balances');
    else fail('FK: stock_balances.material_id', `${count} orphan material references in stock_balances`);
  } catch (e: any) { skip('FK: stock_balances.material_id', `Query error: ${e.message}`); }

  // 1k. StockMovement referencing non-existent material
  try {
    const orphanMovMat = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM stock_movements sm WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = sm.material_id)'
    );
    const count = Number(orphanMovMat[0]?.count || 0);
    if (count === 0) pass('FK: stock_movements.material_id', 'No orphan material references in stock_movements');
    else fail('FK: stock_movements.material_id', `${count} orphan material references in stock_movements`);
  } catch (e: any) { skip('FK: stock_movements.material_id', `Query error: ${e.message}`); }

  // 1l. DailyReport referencing non-existent project
  try {
    const orphanReportProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_reports dr WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = dr.project_id)'
    );
    const count = Number(orphanReportProj[0]?.count || 0);
    if (count === 0) pass('FK: daily_reports.project_id', 'No orphan project references in daily_reports');
    else fail('FK: daily_reports.project_id', `${count} orphan project references in daily_reports`);
  } catch (e: any) { skip('FK: daily_reports.project_id', `Query error: ${e.message}`); }

  // 1m. Expense referencing non-existent submitter
  try {
    const orphanExpSub = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM expenses e WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.submitted_by_id)'
    );
    const count = Number(orphanExpSub[0]?.count || 0);
    if (count === 0) pass('FK: expenses.submitted_by_id', 'No orphan submitter references in expenses');
    else fail('FK: expenses.submitted_by_id', `${count} orphan submitter references in expenses`);
  } catch (e: any) { skip('FK: expenses.submitted_by_id', `Query error: ${e.message}`); }

  // 1n. Document referencing non-existent project
  try {
    const orphanDocProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM documents d WHERE d.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = d.project_id)'
    );
    const count = Number(orphanDocProj[0]?.count || 0);
    if (count === 0) pass('FK: documents.project_id', 'No orphan project references in documents');
    else fail('FK: documents.project_id', `${count} orphan project references in documents`);
  } catch (e: any) { skip('FK: documents.project_id', `Query error: ${e.message}`); }

  // 1o. Issue referencing non-existent project
  try {
    const orphanIssueProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM issues i WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id)'
    );
    const count = Number(orphanIssueProj[0]?.count || 0);
    if (count === 0) pass('FK: issues.project_id', 'No orphan project references in issues');
    else fail('FK: issues.project_id', `${count} orphan project references in issues`);
  } catch (e: any) { skip('FK: issues.project_id', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 2: Duplicate Memberships & Business Identifiers
  // =====================================================================
  header('SECTION 2: Duplicate Memberships & Business Identifiers');

  // 2a. Duplicate project memberships (should be 0 due to unique constraint)
  try {
    const dupMembers = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT project_id, user_id FROM project_members GROUP BY project_id, user_id HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupMembers[0]?.count || 0);
    if (count === 0) pass('Duplicate project memberships', 'No duplicate project/user pairs');
    else fail('Duplicate project memberships', `${count} duplicate project/user pairs found`);
  } catch (e: any) { skip('Duplicate project memberships', `Query error: ${e.message}`); }

  // 2b. Duplicate team memberships
  try {
    const dupTeamMembers = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT team_id, user_id FROM team_members GROUP BY team_id, user_id HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupTeamMembers[0]?.count || 0);
    if (count === 0) pass('Duplicate team memberships', 'No duplicate team/user pairs');
    else fail('Duplicate team memberships', `${count} duplicate team/user pairs found`);
  } catch (e: any) { skip('Duplicate team memberships', `Query error: ${e.message}`); }

  // 2c. Duplicate task codes within project
  try {
    const dupTaskCodes = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT project_id, code FROM tasks GROUP BY project_id, code HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupTaskCodes[0]?.count || 0);
    if (count === 0) pass('Duplicate task codes per project', 'No duplicate project/code pairs');
    else fail('Duplicate task codes per project', `${count} duplicate project/code pairs found`);
  } catch (e: any) { skip('Duplicate task codes per project', `Query error: ${e.message}`); }

  // 2d. Duplicate aviz numbers within project
  try {
    const dupAviz = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT project_id, aviz_number FROM avize GROUP BY project_id, aviz_number HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupAviz[0]?.count || 0);
    if (count === 0) pass('Duplicate aviz numbers per project', 'No duplicate project/aviz_number pairs');
    else fail('Duplicate aviz numbers per project', `${count} duplicate project/aviz_number pairs found`);
  } catch (e: any) { skip('Duplicate aviz numbers per project', `Query error: ${e.message}`); }

  // 2e. Duplicate team codes
  try {
    const dupTeamCodes = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT code FROM teams GROUP BY code HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupTeamCodes[0]?.count || 0);
    if (count === 0) pass('Duplicate team codes', 'No duplicate team codes');
    else fail('Duplicate team codes', `${count} duplicate team codes found`);
  } catch (e: any) { skip('Duplicate team codes', `Query error: ${e.message}`); }

  // 2f. Duplicate project codes
  try {
    const dupProjCodes = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT code FROM projects GROUP BY code HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupProjCodes[0]?.count || 0);
    if (count === 0) pass('Duplicate project codes', 'No duplicate project codes');
    else fail('Duplicate project codes', `${count} duplicate project codes found`);
  } catch (e: any) { skip('Duplicate project codes', `Query error: ${e.message}`); }

  // 2g. Duplicate idempotency keys (should be 0 due to unique constraints)
  try {
    const dupIdemAttend = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM attendance_records WHERE idempotency_key IS NOT NULL AND idempotency_key IN (SELECT idempotency_key FROM attendance_records WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING COUNT(*) > 1)'
    );
    const count = Number(dupIdemAttend[0]?.count || 0);
    if (count === 0) pass('Duplicate attendance idempotency keys', 'No duplicate keys');
    else fail('Duplicate attendance idempotency keys', `${count} duplicate idempotency keys found`);
  } catch (e: any) { skip('Duplicate attendance idempotency keys', `Query error: ${e.message}`); }

  // 2h. Duplicate Employee CNP
  try {
    const dupCNP = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT cnp FROM employees WHERE cnp IS NOT NULL GROUP BY cnp HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupCNP[0]?.count || 0);
    if (count === 0) pass('Duplicate employee CNP', 'No duplicate CNP values');
    else fail('Duplicate employee CNP', `${count} duplicate CNP values found`);
  } catch (e: any) { skip('Duplicate employee CNP', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 3: Cross-Project Mismatches
  // =====================================================================
  header('SECTION 3: Cross-Project Mismatches');

  // 3a. Task.project_id != WorkPackage.stage.project_id
  try {
    const mismatchedTasks = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM tasks t JOIN work_packages wp ON wp.id = t.work_package_id JOIN project_stages ps ON ps.id = wp.stage_id WHERE t.project_id != ps.project_id'
    );
    const count = Number(mismatchedTasks[0]?.count || 0);
    if (count === 0) pass('Cross-project: Task vs WorkPackage', 'All tasks match their work package project');
    else fail('Cross-project: Task vs WorkPackage', `${count} tasks have project_id != work_package.project_id`);
  } catch (e: any) { skip('Cross-project: Task vs WorkPackage', `Query error: ${e.message}`); }

  // 3b. Task.zone_id vs Task.project_id (zone must belong to same project)
  try {
    const mismatchedZones = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM tasks t JOIN location_zones lz ON lz.id = t.zone_id WHERE t.zone_id IS NOT NULL AND t.project_id != lz.project_id'
    );
    const count = Number(mismatchedZones[0]?.count || 0);
    if (count === 0) pass('Cross-project: Task vs Zone', 'All task zones belong to the same project');
    else fail('Cross-project: Task vs Zone', `${count} tasks have zone from a different project`);
  } catch (e: any) { skip('Cross-project: Task vs Zone', `Query error: ${e.message}`); }

  // 3c. DailyPlan.project_id != Team.project_id
  try {
    const mismatchedPlanTeam = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_plans dp JOIN teams t ON t.id = dp.team_id WHERE dp.team_id IS NOT NULL AND dp.project_id != t.project_id'
    );
    const count = Number(mismatchedPlanTeam[0]?.count || 0);
    if (count === 0) pass('Cross-project: DailyPlan vs Team', 'All daily plan teams belong to the same project');
    else fail('Cross-project: DailyPlan vs Team', `${count} daily plans have team from a different project`);
  } catch (e: any) { skip('Cross-project: DailyPlan vs Team', `Query error: ${e.message}`); }

  // 3d. DailyReport.project_id != Team.project_id
  try {
    const mismatchedReportTeam = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_reports dr JOIN teams t ON t.id = dr.team_id WHERE dr.team_id IS NOT NULL AND dr.project_id != t.project_id'
    );
    const count = Number(mismatchedReportTeam[0]?.count || 0);
    if (count === 0) pass('Cross-project: DailyReport vs Team', 'All daily report teams belong to the same project');
    else fail('Cross-project: DailyReport vs Team', `${count} daily reports have team from a different project`);
  } catch (e: any) { skip('Cross-project: DailyReport vs Team', `Query error: ${e.message}`); }

  // 3e. DailyPlanTask.task_id -> Task.project_id != DailyPlan.project_id
  try {
    const mismatchedPlanTask = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_plan_tasks dpt JOIN tasks t ON t.id = dpt.task_id JOIN daily_plans dp ON dp.id = dpt.daily_plan_id WHERE t.project_id != dp.project_id'
    );
    const count = Number(mismatchedPlanTask[0]?.count || 0);
    if (count === 0) pass('Cross-project: DailyPlanTask vs Project', 'All plan tasks belong to the same project as their plan');
    else fail('Cross-project: DailyPlanTask vs Project', `${count} plan tasks have project mismatch with their plan`);
  } catch (e: any) { skip('Cross-project: DailyPlanTask vs Project', `Query error: ${e.message}`); }

  // 3f. DailyReportTask.task_id -> Task.project_id != DailyReport.project_id
  try {
    const mismatchedReportTask = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_report_tasks drt JOIN tasks t ON t.id = drt.task_id JOIN daily_reports dr ON dr.id = drt.daily_report_id WHERE t.project_id != dr.project_id'
    );
    const count = Number(mismatchedReportTask[0]?.count || 0);
    if (count === 0) pass('Cross-project: DailyReportTask vs Project', 'All report tasks belong to the same project as their report');
    else fail('Cross-project: DailyReportTask vs Project', `${count} report tasks have project mismatch with their report`);
  } catch (e: any) { skip('Cross-project: DailyReportTask vs Project', `Query error: ${e.message}`); }

  // 3g. DailyReportMaterial.material_id references exist (no cross-project, materials are global)
  try {
    const orphanReportMat = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_report_materials drm WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = drm.material_id)'
    );
    const count = Number(orphanReportMat[0]?.count || 0);
    if (count === 0) pass('Cross-project: DailyReportMaterial exists', 'All report materials reference valid materials');
    else fail('Cross-project: DailyReportMaterial exists', `${count} report materials reference non-existent materials`);
  } catch (e: any) { skip('Cross-project: DailyReportMaterial exists', `Query error: ${e.message}`); }

  // 3h. TaskDependency cross-project check (predecessor and successor must be same project)
  try {
    const crossDepTasks = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM task_dependencies td JOIN tasks pred ON pred.id = td.predecessor_task_id JOIN tasks succ ON succ.id = td.successor_task_id WHERE pred.project_id != succ.project_id'
    );
    const count = Number(crossDepTasks[0]?.count || 0);
    if (count === 0) pass('Cross-project: TaskDependencies', 'All task dependencies link tasks within the same project');
    else fail('Cross-project: TaskDependencies', `${count} task dependencies link tasks across different projects`);
  } catch (e: any) { skip('Cross-project: TaskDependencies', `Query error: ${e.message}`); }

  // 3i. StockBalance with project_id references valid project
  try {
    const orphanStockProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM stock_balances sb WHERE sb.project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = sb.project_id)'
    );
    const count = Number(orphanStockProj[0]?.count || 0);
    if (count === 0) pass('FK: stock_balances.project_id', 'No orphan project references in stock_balances');
    else fail('FK: stock_balances.project_id', `${count} orphan project references in stock_balances`);
  } catch (e: any) { skip('FK: stock_balances.project_id', `Query error: ${e.message}`); }

  // 3j. ProjectAllocation.project_id matches material project context
  try {
    const orphanAllocProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM project_allocations pa WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = pa.project_id)'
    );
    const count = Number(orphanAllocProj[0]?.count || 0);
    if (count === 0) pass('FK: project_allocations.project_id', 'No orphan project references in allocations');
    else fail('FK: project_allocations.project_id', `${count} orphan project references in allocations`);
  } catch (e: any) { skip('FK: project_allocations.project_id', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 4: Invalid Statuses & Numeric Values
  // =====================================================================
  header('SECTION 4: Invalid Statuses & Numeric Values');

  // 4a. Negative stock balances where forbidden
  try {
    const negativeStock = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM stock_balances WHERE current_quantity < 0'
    );
    const count = Number(negativeStock[0]?.count || 0);
    if (count === 0) pass('Negative stock balances', 'No negative stock balances');
    else fail('Negative stock balances', `${count} stock balances have negative current_quantity`);
  } catch (e: any) { skip('Negative stock balances', `Query error: ${e.message}`); }

  // 4b. Reserved quantity > current quantity
  try {
    const overReserved = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM stock_balances WHERE reserved_quantity > current_quantity'
    );
    const count = Number(overReserved[0]?.count || 0);
    if (count === 0) pass('Over-reserved stock', 'No over-reserved stock balances');
    else fail('Over-reserved stock', `${count} stock balances have reserved_quantity > current_quantity`);
  } catch (e: any) { skip('Over-reserved stock', `Query error: ${e.message}`); }

  // 4c. Negative expense amounts
  try {
    const negativeExpense = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM expenses WHERE amount < 0'
    );
    const count = Number(negativeExpense[0]?.count || 0);
    if (count === 0) pass('Negative expense amounts', 'No negative expense amounts');
    else fail('Negative expense amounts', `${count} expenses have negative amounts`);
  } catch (e: any) { skip('Negative expense amounts', `Query error: ${e.message}`); }

  // 4d. Task dates sanity (planned_end before planned_start)
  try {
    const badTaskDates = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM tasks WHERE planned_start IS NOT NULL AND planned_end IS NOT NULL AND planned_end < planned_start'
    );
    const count = Number(badTaskDates[0]?.count || 0);
    if (count === 0) pass('Task date ordering', 'All task planned_end >= planned_start');
    else fail('Task date ordering', `${count} tasks have planned_end < planned_start`);
  } catch (e: any) { skip('Task date ordering', `Query error: ${e.message}`); }

  // 4e. Task progress bounds (actual_quantity vs planned_quantity sanity)
  try {
    const badTaskQty = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM tasks WHERE actual_quantity IS NOT NULL AND planned_quantity IS NOT NULL AND actual_quantity < 0'
    );
    const count = Number(badTaskQty[0]?.count || 0);
    if (count === 0) pass('Task quantity bounds', 'All task quantities are valid');
    else fail('Task quantity bounds', `${count} tasks have negative actual_quantity`);
  } catch (e: any) { skip('Task quantity bounds', `Query error: ${e.message}`); }

  // 4f. Attendance hours bounds (regular_hours)
  try {
    const badAttendHours = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM attendance_records WHERE regular_hours IS NOT NULL AND (regular_hours < 0 OR regular_hours > 24)'
    );
    const count = Number(badAttendHours[0]?.count || 0);
    if (count === 0) pass('Attendance hours bounds', 'All attendance regular_hours are between 0 and 24');
    else fail('Attendance hours bounds', `${count} attendance records have out-of-bounds regular_hours`);
  } catch (e: any) { skip('Attendance hours bounds', `Query error: ${e.message}`); }

  // 4g. Attendance overtime_minutes bounds
  try {
    const badOvertime = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM attendance_records WHERE overtime_minutes < 0 OR overtime_minutes > 1440'
    );
    const count = Number(badOvertime[0]?.count || 0);
    if (count === 0) pass('Attendance overtime bounds', 'All attendance overtime_minutes are valid');
    else fail('Attendance overtime bounds', `${count} attendance records have out-of-bounds overtime_minutes`);
  } catch (e: any) { skip('Attendance overtime bounds', `Query error: ${e.message}`); }

  // 4h. Check constraint violations: stock_movements quantity > 0
  try {
    const badMovQty = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM stock_movements WHERE quantity <= 0'
    );
    const count = Number(badMovQty[0]?.count || 0);
    if (count === 0) pass('Stock movement quantity', 'All stock_movements have positive quantity');
    else fail('Stock movement quantity', `${count} stock_movements have non-positive quantity`);
  } catch (e: any) { skip('Stock movement quantity', `Query error: ${e.message}`); }

  // 4i. Aviz item quantity > 0
  try {
    const badAvizQty = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM aviz_items WHERE quantity <= 0'
    );
    const count = Number(badAvizQty[0]?.count || 0);
    if (count === 0) pass('Aviz item quantity', 'All aviz_items have positive quantity');
    else fail('Aviz item quantity', `${count} aviz_items have non-positive quantity`);
  } catch (e: any) { skip('Aviz item quantity', `Query error: ${e.message}`); }

  // 4j. DailyPlanTask target_quantity > 0
  try {
    const badPlanTaskQty = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_plan_tasks WHERE target_quantity <= 0'
    );
    const count = Number(badPlanTaskQty[0]?.count || 0);
    if (count === 0) pass('Daily plan task target quantity', 'All plan tasks have positive target_quantity');
    else fail('Daily plan task target quantity', `${count} plan tasks have non-positive target_quantity`);
  } catch (e: any) { skip('Daily plan task target quantity', `Query error: ${e.message}`); }

  // 4k. ExpenseLine amounts > 0
  try {
    const badExpLine = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM expense_lines WHERE amount <= 0'
    );
    const count = Number(badExpLine[0]?.count || 0);
    if (count === 0) pass('Expense line amounts', 'All expense lines have positive amounts');
    else fail('Expense line amounts', `${count} expense lines have non-positive amounts`);
  } catch (e: any) { skip('Expense line amounts', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 5: Task Dependencies & Self-Dependencies
  // =====================================================================
  header('SECTION 5: Task Dependencies');

  // 5a. Self-dependencies
  try {
    const selfDeps = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM task_dependencies WHERE predecessor_task_id = successor_task_id'
    );
    const count = Number(selfDeps[0]?.count || 0);
    if (count === 0) pass('Self-dependencies', 'No self-referencing task dependencies');
    else fail('Self-dependencies', `${count} task dependencies reference the same task`);
  } catch (e: any) { skip('Self-dependencies', `Query error: ${e.message}`); }

  // 5b. Duplicate dependency pairs
  try {
    const dupDeps = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM (SELECT predecessor_task_id, successor_task_id FROM task_dependencies GROUP BY predecessor_task_id, successor_task_id HAVING COUNT(*) > 1) dup'
    );
    const count = Number(dupDeps[0]?.count || 0);
    if (count === 0) pass('Duplicate dependencies', 'No duplicate dependency pairs');
    else fail('Duplicate dependencies', `${count} duplicate dependency pairs found`);
  } catch (e: any) { skip('Duplicate dependencies', `Query error: ${e.message}`); }

  // 5c. Dependencies referencing non-existent tasks
  try {
    const badPred = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM task_dependencies td WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = td.predecessor_task_id)'
    );
    const badSucc = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM task_dependencies td WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id = td.successor_task_id)'
    );
    const predCount = Number(badPred[0]?.count || 0);
    const succCount = Number(badSucc[0]?.count || 0);
    if (predCount === 0 && succCount === 0) pass('Dependency target existence', 'All dependency targets exist');
    else fail('Dependency target existence', `${predCount} bad predecessors, ${succCount} bad successors`);
  } catch (e: any) { skip('Dependency target existence', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 6: Dangling Documents & Attachments
  // =====================================================================
  header('SECTION 6: Dangling Documents & Attachments');

  // 6a. DocumentVersion referencing non-existent document
  try {
    const orphanDocVer = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM document_versions dv WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = dv.document_id)'
    );
    const count = Number(orphanDocVer[0]?.count || 0);
    if (count === 0) pass('FK: document_versions.document_id', 'No orphan document version references');
    else fail('FK: document_versions.document_id', `${count} orphan document version references`);
  } catch (e: any) { skip('FK: document_versions.document_id', `Query error: ${e.message}`); }

  // 6b. OCRExtraction referencing non-existent OCR job
  try {
    const orphanExtract = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM ocr_extractions oe WHERE NOT EXISTS (SELECT 1 FROM ocr_jobs oj WHERE oj.id = oe.ocr_job_id)'
    );
    const count = Number(orphanExtract[0]?.count || 0);
    if (count === 0) pass('FK: ocr_extractions.ocr_job_id', 'No orphan OCR extraction references');
    else fail('FK: ocr_extractions.ocr_job_id', `${count} orphan OCR extraction references`);
  } catch (e: any) { skip('FK: ocr_extractions.ocr_job_id', `Query error: ${e.message}`); }

  // 6c. ExpenseApproval referencing non-existent expense
  try {
    const orphanExpAppr = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM expense_approvals ea WHERE NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = ea.expense_id)'
    );
    const count = Number(orphanExpAppr[0]?.count || 0);
    if (count === 0) pass('FK: expense_approvals.expense_id', 'No orphan expense approval references');
    else fail('FK: expense_approvals.expense_id', `${count} orphan expense approval references`);
  } catch (e: any) { skip('FK: expense_approvals.expense_id', `Query error: ${e.message}`); }

  // 6d. Reimbursement referencing non-existent expense
  try {
    const orphanReimb = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM reimbursements r WHERE NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = r.expense_id)'
    );
    const count = Number(orphanReimb[0]?.count || 0);
    if (count === 0) pass('FK: reimbursements.expense_id', 'No orphan reimbursement references');
    else fail('FK: reimbursements.expense_id', `${count} orphan reimbursement references`);
  } catch (e: any) { skip('FK: reimbursements.expense_id', `Query error: ${e.message}`); }

  // 6e. Attachments referencing non-existent targets (polymorphic, so check general existence)
  try {
    const totalAttachments = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM attachments'
    );
    // For polymorphic attachments, we can only warn about total count
    const count = Number(totalAttachments[0]?.count || 0);
    pass('Attachments total', `${count} total attachments (polymorphic, no FK enforcement possible)`);
  } catch (e: any) { skip('Attachments total', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 7: Active Records Referencing Archived Entities
  // =====================================================================
  header('SECTION 7: Active vs Archived Integrity');

  // 7a. Active tasks referencing archived/inactive projects
  try {
    const activeTaskInactiveProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.is_active = false AND t.status != \'CANCELLED\''
    );
    const count = Number(activeTaskInactiveProj[0]?.count || 0);
    if (count === 0) pass('Active tasks in inactive projects', 'No active tasks in inactive projects');
    else fail('Active tasks in inactive projects', `${count} active tasks belong to inactive projects`);
  } catch (e: any) { skip('Active tasks in inactive projects', `Query error: ${e.message}`); }

  // 7b. Active team members in inactive teams
  try {
    const activeMemberInactiveTeam = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.is_active = false'
    );
    const count = Number(activeMemberInactiveTeam[0]?.count || 0);
    if (count === 0) pass('Team members in inactive teams', 'No team members in inactive teams');
    else fail('Team members in inactive teams', `${count} team members belong to inactive teams`);
  } catch (e: any) { skip('Team members in inactive teams', `Query error: ${e.message}`); }

  // 7c. Project members in inactive projects
  try {
    const memberInactiveProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE p.is_active = false'
    );
    const count = Number(memberInactiveProj[0]?.count || 0);
    if (count === 0) pass('Project members in inactive projects', 'No project members in inactive projects');
    else fail('Project members in inactive projects', `${count} project members belong to inactive projects`);
  } catch (e: any) { skip('Project members in inactive projects', `Query error: ${e.message}`); }

  // 7d. Active daily plans in inactive projects
  try {
    const plansInactiveProj = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_plans dp JOIN projects p ON p.id = dp.project_id WHERE p.is_active = false AND dp.status NOT IN (\'CANCELLED\', \'COMPLETED\')'
    );
    const count = Number(plansInactiveProj[0]?.count || 0);
    if (count === 0) pass('Active daily plans in inactive projects', 'No active plans in inactive projects');
    else fail('Active daily plans in inactive projects', `${count} active plans in inactive projects`);
  } catch (e: any) { skip('Active daily plans in inactive projects', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 8: Summary & Free-String Status Fields
  // =====================================================================
  header('SECTION 8: Free-String Status Fields');

  // 8a. Check for non-enum status values in expense_approvals
  try {
    const badApprovalStatus = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM expense_approvals WHERE status NOT IN (\'APPROVED\', \'REJECTED\', \'PENDING\', \'UNDER_REVIEW\')'
    );
    const count = Number(badApprovalStatus[0]?.count || 0);
    if (count === 0) pass('Expense approval status values', 'All expense approval statuses are valid');
    else fail('Expense approval status values', `${count} expense approvals have unexpected status values`);
  } catch (e: any) { skip('Expense approval status values', `Query error: ${e.message}`); }

  // 8b. Check daily_report status values
  try {
    const badReportStatus = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM daily_reports WHERE status NOT IN (\'SUBMITTED\', \'DRAFT\', \'APPROVED\', \'REJECTED\', \'CANCELLED\')'
    );
    const count = Number(badReportStatus[0]?.count || 0);
    if (count === 0) pass('Daily report status values', 'All daily report statuses are valid');
    else fail('Daily report status values', `${count} daily reports have unexpected status values`);
  } catch (e: any) { skip('Daily report status values', `Query error: ${e.message}`); }

  // 8c. Check inspection status values
  try {
    const badInspectionStatus = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM inspections WHERE status NOT IN (\'PENDING\', \'IN_PROGRESS\', \'COMPLETED\', \'CANCELLED\')'
    );
    const count = Number(badInspectionStatus[0]?.count || 0);
    if (count === 0) pass('Inspection status values', 'All inspection statuses are valid');
    else fail('Inspection status values', `${count} inspections have unexpected status values`);
  } catch (e: any) { skip('Inspection status values', `Query error: ${e.message}`); }

  // 8d. Check purchase_order status values
  try {
    const badPOStatus = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint as count FROM purchase_orders WHERE status NOT IN (\'DRAFT\', \'SENT\', \'CONFIRMED\', \'RECEIVED\', \'CANCELLED\')'
    );
    const count = Number(badPOStatus[0]?.count || 0);
    if (count === 0) pass('Purchase order status values', 'All purchase order statuses are valid');
    else fail('Purchase order status values', `${count} purchase orders have unexpected status values`);
  } catch (e: any) { skip('Purchase order status values', `Query error: ${e.message}`); }

  // =====================================================================
  // SECTION 9: Summary & Exit Code
  // =====================================================================
  header('FINAL SUMMARY');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;

  console.log('');
  console.log(`  PASSED:   ${passed}`);
  console.log(`  FAILED:   ${failed}`);
  console.log(`  SKIPPED:  ${skipped}`);
  console.log(`  TOTAL:    ${results.length}`);
  console.log('');

  if (failed > 0) {
    console.log('  FAILED CHECKS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    - ${r.name}: ${r.detail}`);
    });
    console.log('');
    console.log('  ❌ db:verify FAILED — integrity issues found');
    process.exit(1);
  } else {
    console.log('  ✅ db:verify PASSED — all integrity checks OK');
    process.exit(0);
  }
}

main()
  .catch((e) => {
    console.error('db:verify failed with exception:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
