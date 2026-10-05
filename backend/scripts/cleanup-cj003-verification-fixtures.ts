import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FIXTURE_CODES = ['SMOKE-40926', 'PH2-VER-01', 'P3-GATE-T1', 'P3-GATE-T2'];

async function main() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Refusing verification-fixture cleanup unless NODE_ENV=development.');
  const apply = process.argv.includes('--apply');
  const project = await prisma.project.findUnique({ where: { code: 'CJ-003' }, select: { id: true } });
  if (!project) throw new Error('CJ-003 project not found.');

  const tasks = await prisma.task.findMany({
    where: { project_id: project.id, code: { in: FIXTURE_CODES } },
    select: { id: true, code: true, title: true },
  });
  console.log(`${apply ? '[APPLY]' : '[DRY-RUN]'} Found ${tasks.length}/${FIXTURE_CODES.length} fixture tasks.`);
  for (const task of tasks) console.log(` - ${task.code}: ${task.title}`);
  if (!apply) {
    console.log('No rows changed. Re-run with --apply only after accepting the verification-evidence impact.');
    return;
  }

  const ids = tasks.map((t) => t.id);
  await prisma.$transaction(async (tx) => {
    await tx.dailyPlanTask.deleteMany({ where: { task_id: { in: ids } } });
    await tx.taskAssignment.deleteMany({ where: { task_id: { in: ids } } });
    await tx.task.deleteMany({ where: { id: { in: ids } } });
  });
  console.log(`Deleted ${ids.length} CJ-003 verification fixture tasks.`);
  console.log('Audit/evidence documents are intentionally not rewritten by this script.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
