// ============================================================================
// Evidence-derived ProjectMember backfill (R2.1 P5)
// ============================================================================
// Usage:
//   npx ts-node backend/scripts/backfill-project-members.ts              # apply
//   npx ts-node backend/scripts/backfill-project-members.ts --dry-run    # dry-run
//
// Derives membership candidates from existing data evidence.
// Idempotent — skips existing ProjectMember rows.
// Reports any project with zero derivable members.
// ============================================================================

import { PrismaClient, UserRoleEnum } from '@prisma/client';

const prisma = new PrismaClient();

const GLOBAL_SCOPE_ROLES: UserRoleEnum[] = [
  UserRoleEnum.ADMIN,
  UserRoleEnum.OWNER,
  UserRoleEnum.PM,
  UserRoleEnum.MANAGER,
];

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const logPrefix = isDryRun ? '[DRY-RUN]' : '[APPLY]';

  console.log(`${logPrefix} Starting evidence-derived ProjectMember backfill...`);
  console.log(`${logPrefix} Dry-run mode: ${isDryRun}`);
  console.log('');

  const projects = await prisma.project.findMany({
    where: { is_active: true },
    select: { id: true, name: true, code: true },
  });
  console.log(`Found ${projects.length} active projects.`);
  console.log('');

  let totalCreated = 0;
  const zeroMemberProjects: Array<{ id: string; name: string; code: string }> = [];


  for (const project of projects) {
    const projectId = project.id;

    // Get existing members to skip
    const existingMemberUserIds = new Set(
      (
        await prisma.projectMember.findMany({
          where: { project_id: projectId },
          select: { user_id: true },
        })
      ).map((m) => m.user_id),
    );

    const candidateUserIds = new Set<string>();

    // ── 1. Global-scope users in the same organization ────────────────
    const projOrg = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organization_id: true },
    });
    if (projOrg) {
      const globalUsers = await prisma.user.findMany({
        where: {
          organization_id: projOrg.organization_id,
          role: { in: GLOBAL_SCOPE_ROLES },
        },
        select: { id: true },
      });
      for (const u of globalUsers) {
        if (!existingMemberUserIds.has(u.id)) {
          candidateUserIds.add(u.id);
        }
      }
    }

    // ── 2. Users with attendance records for this project ─────────────
    const attendanceUsers = await prisma.attendanceRecord.findMany({
      where: { project_id: projectId },
      select: { user_id: true },
    });
    for (const a of attendanceUsers) {
      if (!existingMemberUserIds.has(a.user_id)) {
        candidateUserIds.add(a.user_id);
      }
    }

    // ── 3. Users in teams belonging to this project ───────────────────
    const teamMembers = await prisma.teamMember.findMany({
      where: { team: { project_id: projectId } },
      select: { user_id: true },
    });
    for (const tm of teamMembers) {
      if (!existingMemberUserIds.has(tm.user_id)) {
        candidateUserIds.add(tm.user_id);
      }
    }

    // ── 4. Creators of DailyPlans for this project ────────────────────
    const planUsers = await prisma.dailyPlan.findMany({
      where: { project_id: projectId, created_by: { not: null } },
      select: { created_by: true },
    });
    for (const p of planUsers) {
      if (p.created_by && !existingMemberUserIds.has(p.created_by)) {
        candidateUserIds.add(p.created_by);
      }
    }

    // ── 5. Team leaders of DailyReports for this project ──────────────
    const reportUsers = await prisma.dailyReport.findMany({
      where: { project_id: projectId },
      select: { team_leader_id: true },
    });
    for (const r of reportUsers) {
      if (!existingMemberUserIds.has(r.team_leader_id)) {
        candidateUserIds.add(r.team_leader_id);
      }
    }

    // ── 6. Users who submitted Expenses for this project ──────────────
    const expenseUsers = await prisma.expense.findMany({
      where: { project_id: projectId },
      select: { submitted_by_id: true },
    });
    for (const e of expenseUsers) {
      if (!existingMemberUserIds.has(e.submitted_by_id)) {
        candidateUserIds.add(e.submitted_by_id);
      }
    }

    // ── 7. Users who created Issues for this project ──────────────────
    const issueUsers = await prisma.issue.findMany({
      where: { project_id: projectId },
      select: { reported_by: true },
    });
    for (const i of issueUsers) {
      if (!existingMemberUserIds.has(i.reported_by)) {
        candidateUserIds.add(i.reported_by);
      }
    }

    // ── 8. Users assigned to Tasks for this project ───────────────────
    const taskAssignments = await prisma.taskAssignment.findMany({
      where: { task: { project_id: projectId } },
      select: { user_id: true },
    });
    for (const ta of taskAssignments) {
      if (!existingMemberUserIds.has(ta.user_id)) {
        candidateUserIds.add(ta.user_id);
      }
    }

    // ── Report ────────────────────────────────────────────────────────
    const candidates = Array.from(candidateUserIds);
    if (candidates.length === 0 && existingMemberUserIds.size === 0) {
      zeroMemberProjects.push({ id: project.id, name: project.name, code: project.code });
    }

    if (candidates.length > 0) {
      console.log(
        `${logPrefix} Project "${project.name}" (${project.code}): ${existingMemberUserIds.size} existing, ${candidates.length} new candidates`,
      );

      if (!isDryRun) {
        const users = await prisma.user.findMany({
          where: { id: { in: candidates } },
          select: { id: true, role: true },
        });

        for (const user of users) {
          const membershipRole = GLOBAL_SCOPE_ROLES.includes(user.role)
            ? user.role
            : UserRoleEnum.TEAM_LEADER;

          try {
            await prisma.projectMember.create({
              data: {
                project_id: projectId,
                user_id: user.id,
                role: membershipRole,
              },
            });
            totalCreated++;
          } catch (err: any) {
            if (!err.message?.includes('Unique constraint')) {
              console.error(`  Error creating member for user ${user.id}: ${err.message}`);
            }
          }
        }
      }
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('');
  console.log(`${logPrefix} Total new ProjectMember rows created: ${totalCreated}`);

  if (zeroMemberProjects.length > 0) {
    console.warn('');
    console.warn('⚠️  WARNING — Projects with ZERO derivable members:');
    for (const p of zeroMemberProjects) {
      console.warn(`   - "${p.name}" (${p.code}) [id: ${p.id}]`);
    }
    console.warn('');
    console.warn('These projects need manual membership assignment after backfill.');
  }

  // ── Zero-evidence users report ─────────────────────────────────────
  const allUsers = await prisma.user.findMany({
    where: { is_active: true },
    select: { id: true, email: true, role: true },
  });
  const allMemberUserIds = new Set(
    (await prisma.projectMember.findMany({ select: { user_id: true } })).map((m) => m.user_id),
  );
  const zeroEvidenceUsers = allUsers.filter((u) => !allMemberUserIds.has(u.id));
  if (zeroEvidenceUsers.length > 0) {
    console.warn('');
    console.warn(`ℹ️  Users with no project membership (${zeroEvidenceUsers.length}):`);
    for (const u of zeroEvidenceUsers) {
      console.warn(`   - ${u.email} (${u.role})`);
    }
    console.warn('These users have no operational evidence linking them to any project.');
  }

  if (isDryRun) {
    console.log('');
    console.log('Dry-run complete. Re-run without --dry-run to apply.');
  } else {
    console.log('');
    console.log('Backfill complete.');
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

