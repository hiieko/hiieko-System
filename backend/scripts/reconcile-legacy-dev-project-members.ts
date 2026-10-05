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

const APPLY_CONFIRMATION = 'I-UNDERSTAND-THIS-IS-A-DEVELOPMENT-DATABASE';
const DEFAULT_DEV_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type Reconciliation = {
  email: string;
  projectCode: string;
  userId: string;
  projectId: string;
  userRole: UserRoleEnum;
};

function getDatabaseTarget(): { host: string; database: string } {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  const database = url.pathname.replace(/^\//, '');
  if (!database) throw new Error('DATABASE_URL must include a database name.');
  return { host: url.hostname, database };
}

function assertDevelopmentDatabase(apply: boolean) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing development-user reconciliation unless NODE_ENV=development.');
  }

  const target = getDatabaseTarget();
  const allowedHosts = new Set(
    (process.env.DEV_DATABASE_HOST_ALLOWLIST ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const host of DEFAULT_DEV_DB_HOSTS) allowedHosts.add(host);

  if (!allowedHosts.has(target.host.toLowerCase())) {
    throw new Error(
      'Refusing reconciliation against database host "' + target.host + '". ' +
      'Use a local development database or explicitly add its host to DEV_DATABASE_HOST_ALLOWLIST.',
    );
  }

  if (apply && process.env.DEV_DATABASE_RECONCILIATION_CONFIRM !== APPLY_CONFIRMATION) {
    throw new Error(
      'Refusing --apply without DEV_DATABASE_RECONCILIATION_CONFIRM=' + APPLY_CONFIRMATION + '.',
    );
  }

  console.log('Database safety target: host=' + target.host + ', database=' + target.database);
}

async function main() {
  const apply = process.argv.includes('--apply');
  assertDevelopmentDatabase(apply);

  const projects = await prisma.project.findMany({
    where: { code: { in: ['AR-001', 'TM-002', 'CJ-003'] } },
    select: { id: true, code: true },
  });
  const projectByCode = new Map(projects.map((p) => [p.code, p.id]));

  const summary = { missing: 0, alreadyCorrect: 0, roleMismatch: 0, wouldCreate: 0 };
  const pending: Reconciliation[] = [];

  for (const item of ASSIGNMENTS) {
    const user = await prisma.user.findUnique({
      where: { email: item.email },
      select: { id: true, role: true },
    });
    const projectId = projectByCode.get(item.projectCode);

    if (!user || !projectId) {
      summary.missing++;
      console.warn(
        '[MISSING] ' + item.email + ' -> ' + item.projectCode + ': ' +
        (!user ? 'user' : 'project') + ' not found',
      );
      continue;
    }

    const existing = await prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: user.id } },
      select: { role: true },
    });

    if (existing) {
      if (existing.role === user.role) {
        summary.alreadyCorrect++;
        console.log('[OK] ' + item.email + ' -> ' + item.projectCode + ' already assigned as ' + existing.role);
      } else {
        summary.roleMismatch++;
        console.error('[ROLE-MISMATCH] ' + item.email + ' -> ' + item.projectCode + ': membership=' + existing.role + ', user=' + user.role);
      }
      continue;
    }

    summary.wouldCreate++;
    pending.push({
      email: item.email,
      projectCode: item.projectCode,
      userId: user.id,
      projectId,
      userRole: user.role as UserRoleEnum,
    });
    console.log('[' + (apply ? 'PENDING-APPLY' : 'DRY-RUN') + '] ' + item.email + ' -> ' + item.projectCode + ' as ' + user.role);
  }

  console.log(
    'Summary: missing=' + summary.missing + ', already-correct=' + summary.alreadyCorrect +
    ', role-mismatch=' + summary.roleMismatch + ', would-create=' + summary.wouldCreate + '.',
  );

  if (summary.roleMismatch > 0) {
    throw new Error('Role mismatches found. No memberships were changed; resolve them explicitly first.');
  }

  if (!apply) {
    console.log('Dry-run only. Re-run with --apply plus the required development database confirmation to write changes.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const item of pending) {
      await tx.projectMember.create({
        data: { project_id: item.projectId, user_id: item.userId, role: item.userRole },
      });
    }
  });

  console.log('Applied: created ' + pending.length + ' ProjectMember rows atomically.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());