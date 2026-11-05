import { PrismaClient, UserRoleEnum, UserStatusEnum } from '@prisma/client';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const COMPANY_DOMAIN = '@hiieko.ro';
const BOOTSTRAP_ACTION = 'SUPER_ADMIN_BOOTSTRAPPED';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required bootstrap setting: ${name}`);
  return value;
}

function assertUuid(name: string, value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${name} must be a UUID`);
  }
}

async function main(): Promise<void> {
  if (process.env.HIIEKO_SUPER_ADMIN_BOOTSTRAP_ENABLED !== 'true') {
    throw new Error('Bootstrap is disabled. Enable it only for the approved one-time operation.');
  }
  if (!stdin.isTTY) throw new Error('Bootstrap must run interactively from the protected operator console.');

  const tenantId = required('ENTRA_TENANT_ID');
  const userId = required('HIIEKO_SUPER_ADMIN_USER_ID');
  const objectId = required('HIIEKO_SUPER_ADMIN_OBJECT_ID');
  const operator = required('HIIEKO_SUPER_ADMIN_OPERATOR');
  const approver = required('HIIEKO_SUPER_ADMIN_APPROVER');
  assertUuid('ENTRA_TENANT_ID', tenantId);
  assertUuid('HIIEKO_SUPER_ADMIN_USER_ID', userId);
  assertUuid('HIIEKO_SUPER_ADMIN_OBJECT_ID', objectId);
  if (operator.toLowerCase() === approver.toLowerCase()) {
    throw new Error('Bootstrap operator and approver must be different people.');
  }

  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const confirmation = await readline.question(`Type BOOTSTRAP ${userId} to continue: `);
    if (confirmation !== `BOOTSTRAP ${userId}`) throw new Error('Bootstrap confirmation did not match.');
  } finally {
    readline.close();
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      // Serialize concurrent invocations so the audit marker is a global one-time latch.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(719304, 1)`;
      const alreadyBootstrapped = await tx.auditLog.findFirst({
        where: { action: BOOTSTRAP_ACTION, entity: 'System', entity_id: 'super-administrator' },
        select: { id: true },
      });
      if (alreadyBootstrapped) throw new Error('The one-time Super Administrator bootstrap was already used.');

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, status: true, is_active: true, role: true, organization_id: true },
      });
      if (
        !user ||
        user.status !== UserStatusEnum.ACTIVE ||
        !user.is_active ||
        !user.email.toLowerCase().endsWith(COMPANY_DOMAIN)
      ) {
        throw new Error('Bootstrap target must be an existing, active, administrator-approved @hiieko.ro user.');
      }

      await tx.microsoftIdentityLink.create({
        data: { user_id: user.id, tenant_id: tenantId, object_id: objectId },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { role: UserRoleEnum.OWNER },
      });
      await tx.auditLog.create({
        data: {
          organization_id: user.organization_id,
          action: BOOTSTRAP_ACTION,
          entity: 'System',
          entity_id: 'super-administrator',
          before_state: { role: user.role },
          after_state: { userId: user.id, role: UserRoleEnum.OWNER, tenantId, objectId },
          metadata: { operator, approver, oneTime: true },
        },
      });
    });
    console.log('Super Administrator bootstrap completed. Disable and remove bootstrap settings now.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Do not print secrets, tokens, or connection URLs.
  console.error(error instanceof Error ? error.message : 'Super Administrator bootstrap failed.');
  process.exitCode = 1;
});
