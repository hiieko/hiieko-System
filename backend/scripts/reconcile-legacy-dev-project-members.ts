import { PrismaClient, UserRoleEnum } from '@prisma/client';

const prisma = new PrismaClient();

const ASSIGNMENTS: Array<{ email: string; projectCode: string }> = [
  { email: 'ion.munteanu@hiieko.local', projectCode: 'AR-001' },
  { email: 'costin.dumitrescu@hiieko.local', projectCode: 'AR-001' },
  { email: 'ramona.popa@hiieko.local', projectCode: 'AR-001' },
  { email: 'maria.popescu@hiieko.local', projectCode: 'TM-002' },
  { email: 'daniel.georgescu@hiieko.local', projectCode: 'TM-002' },
  { email: 'ioana.niculescu@hiieko.local', projectCode: 'TM-002' },
  { email: 'andrei.popovici@hiieko.local', projectCode: 'CJ-003' },
  { email: 'alexandru.ivan@hiieko.local', projectCode: 'CJ-003' },
];

async function main() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Refusing development-user reconciliation unless NODE_ENV=development.');
  const apply = process.argv.includes('--apply');
  const projects = await prisma.project.findMany({
    where: { code: { in: ['AR-001', 'TM-002', 'CJ-003'] } },
    select: { id: true, code: true },
  });
  const projectByCode = new Map(projects.map((p) => [p.code, p.id]));

  let created = 0;
  for (const item of ASSIGNMENTS) {
    const user = await prisma.user.findUnique({ where: { email: item.email }, select: { id: true, role: true } });
    const projectId = projectByCode.get(item.projectCode);
    if (!user || !projectId) {
      console.warn(`Missing user/project: ${item.email} -> ${item.projectCode}`);
      continue;
    }
    const existing = await prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: user.id } },
    });
    if (existing) continue;
    console.log(`${apply ? '[APPLY]' : '[DRY-RUN]'} ${item.email} -> ${item.projectCode} as ${user.role}`);
    if (apply) {
      await prisma.projectMember.create({
        data: { project_id: projectId, user_id: user.id, role: user.role as UserRoleEnum },
      });
      created++;
    }
  }
  console.log(`${apply ? 'Created' : 'Would create'} ${created} ProjectMember rows.`);
  if (!apply) console.log('Re-run with --apply to write changes.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
