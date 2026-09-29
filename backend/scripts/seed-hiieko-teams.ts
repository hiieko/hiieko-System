// ============================================================================
// HIIEKO — Development accounts / teams / projects / tasks seed (REAL DB ROWS)
// ============================================================================
// Usage (from the repository root):
//   npm run seed:teams --workspace=backend
//   # or
//   npx ts-node --transpile-only backend/scripts/seed-hiieko-teams.ts
//
// What it creates (PostgreSQL rows — no JSON files, no mock/frontend-only data):
//   1. 12 development accounts: 3 x TEAM_LEADER (chef), 3 x FOREMAN,
//      3 x WORKER, 3 x TECHNICIAN — one group per project
//   2. UserProfile + Employee rows for every account
//   3. ProjectMember rows for every account. REQUIRED: the API scopes
//      /api/projects, /api/teams, /api/tasks and /api/daily-plans by
//      ProjectMember membership (see ProjectAccessGuard + buildScopedProjectWhere).
//      Without these rows a non-global role sees nothing in the frontend.
//   4. One Team per project (Team.leader_id + TeamMember roster)
//   5. ProjectStage + WorkPackage + LocationZone per project
//   6. Four tasks per project with TaskAssignment rows
//   7. One PUBLISHED DailyPlan for today per team (feeds the worker
//      "My day" dashboard and the /planning page)
//
// The three projects already exist in the database and are matched by code
// (AR-001 / TM-002 / CJ-003). No duplicate projects are created.
//
// IDEMPOTENT — every write is an upsert on a natural key, safe to re-run.
// DEVELOPMENT ONLY — never point this at production data.
// ============================================================================

import {
  DailyPlanStatusEnum,
  PrismaClient,
  ProjectStatusEnum,
  TaskStatusEnum,
  UserRoleEnum,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from backend/.env (this script runs from backend/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const ORG_NAME = 'HIIEKO Development';

// ============================================================================
// Account definitions (development credentials — role based, easy to remember)
// ============================================================================

interface AccountDef {
  teamCode: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRoleEnum;
  position: string;
  hourlyRate: number;
  phone: string;
  employeeCode: string;
}

const ACCOUNTS: AccountDef[] = [
  // ── Proiect AR-001 — Parc Solar Arad ────────────────────────────────────
  {
    teamCode: 'AR-E1',
    email: 'chef1@hiieko.com',
    password: 'chef123',
    fullName: 'Cristian Ionescu',
    role: UserRoleEnum.TEAM_LEADER,
    position: 'Sef echipa montaj',
    hourlyRate: 45,
    phone: '+40720111001',
    employeeCode: 'HII-AR-E1-01',
  },
  {
    teamCode: 'AR-E1',
    email: 'fore1@hiieko.com',
    password: 'foreman123',
    fullName: 'Florin Dumitru',
    role: UserRoleEnum.FOREMAN,
    position: 'Maistru',
    hourlyRate: 40,
    phone: '+40720111002',
    employeeCode: 'HII-AR-E1-02',
  },
  {
    teamCode: 'AR-E1',
    email: 'wor1@hiieko.com',
    password: 'worker123',
    fullName: 'George Marin',
    role: UserRoleEnum.WORKER,
    position: 'Muncitor montaj',
    hourlyRate: 32,
    phone: '+40720111003',
    employeeCode: 'HII-AR-E1-03',
  },
  {
    teamCode: 'AR-E1',
    email: 'tech1@hiieko.com',
    password: 'tech123',
    fullName: 'Tudor Vasile',
    role: UserRoleEnum.TECHNICIAN,
    position: 'Tehnician electric',
    hourlyRate: 38,
    phone: '+40720111004',
    employeeCode: 'HII-AR-E1-04',
  },

  // ── Proiect TM-002 — Parc Solar Timisoara ───────────────────────────────
  {
    teamCode: 'TM-E1',
    email: 'chef2@hiieko.com',
    password: 'chef123',
    fullName: 'Catalin Barbu',
    role: UserRoleEnum.TEAM_LEADER,
    position: 'Sef echipa montaj',
    hourlyRate: 45,
    phone: '+40720111005',
    employeeCode: 'HII-TM-E1-01',
  },
  {
    teamCode: 'TM-E1',
    email: 'fore2@hiieko.com',
    password: 'foreman123',
    fullName: 'Marian Pavel',
    role: UserRoleEnum.FOREMAN,
    position: 'Maistru',
    hourlyRate: 40,
    phone: '+40720111006',
    employeeCode: 'HII-TM-E1-02',
  },
  {
    teamCode: 'TM-E1',
    email: 'wor2@hiieko.com',
    password: 'worker123',
    fullName: 'Gabriel Stoica',
    role: UserRoleEnum.WORKER,
    position: 'Muncitor montaj',
    hourlyRate: 32,
    phone: '+40720111007',
    employeeCode: 'HII-TM-E1-03',
  },
  {
    teamCode: 'TM-E1',
    email: 'tech2@hiieko.com',
    password: 'tech123',
    fullName: 'Teodor Lupu',
    role: UserRoleEnum.TECHNICIAN,
    position: 'Tehnician electric',
    hourlyRate: 38,
    phone: '+40720111008',
    employeeCode: 'HII-TM-E1-04',
  },

  // ── Proiect CJ-003 — Parc Solar Cluj ────────────────────────────────────
  {
    teamCode: 'CJ-E1',
    email: 'chef3@hiieko.com',
    password: 'chef123',
    fullName: 'Cosmin Radu',
    role: UserRoleEnum.TEAM_LEADER,
    position: 'Sef echipa montaj',
    hourlyRate: 45,
    phone: '+40720111009',
    employeeCode: 'HII-CJ-E1-01',
  },
  {
    teamCode: 'CJ-E1',
    email: 'fore3@hiieko.com',
    password: 'foreman123',
    fullName: 'Mihai Toma',
    role: UserRoleEnum.FOREMAN,
    position: 'Maistru',
    hourlyRate: 40,
    phone: '+40720111010',
    employeeCode: 'HII-CJ-E1-02',
  },
  {
    teamCode: 'CJ-E1',
    email: 'work3@hiieko.com',
    password: 'worker123',
    fullName: 'Bogdan Neagu',
    role: UserRoleEnum.WORKER,
    position: 'Muncitor montaj',
    hourlyRate: 32,
    phone: '+40720111011',
    employeeCode: 'HII-CJ-E1-03',
  },
  {
    teamCode: 'CJ-E1',
    email: 'tech3@hiieko.com',
    password: 'tech123',
    fullName: 'Ionut Sava',
    role: UserRoleEnum.TECHNICIAN,
    position: 'Tehnician electric',
    hourlyRate: 38,
    phone: '+40720111012',
    employeeCode: 'HII-CJ-E1-04',
  },
];

// ============================================================================
// Team / project / stage / task definitions
// ============================================================================

interface StageDef {
  order: number;
  name: string;
  status: ProjectStatusEnum;
  startOffset: number;
  endOffset: number;
  workPackageCode: string;
  workPackageName: string;
}

interface TaskDef {
  code: string;
  title: string;
  description: string;
  status: TaskStatusEnum;
  workPackageCode: string;
  plannedStartOffset: number;
  plannedEndOffset: number;
  plannedQuantity: number;
  unitOfMeasure: string;
  actualQuantity?: number;
  actualStartOffset?: number;
  actualEndOffset?: number;
  assigneeEmails: string[];
  /** Quantity carried into today's PUBLISHED daily plan for this team. */
  planTargetQuantity: number;
  planCompleted: boolean;
}

interface TeamSeedDef {
  projectCode: string;
  teamCode: string;
  teamName: string;
  zoneCode: string;
  zoneName: string;
  leaderEmail: string;
  foremanEmail: string;
  /** Everyone on the roster, including the leader and the foreman. */
  memberEmails: string[];
  stages: StageDef[];
  tasks: TaskDef[];
}

function stageSet(prefix: string): StageDef[] {
  return [
    {
      order: 1,
      name: 'Structura de prindere',
      status: ProjectStatusEnum.COMPLETED,
      startOffset: -30,
      endOffset: -8,
      workPackageCode: `${prefix}-WP-STR`,
      workPackageName: 'Montaj structura de prindere',
    },
    {
      order: 2,
      name: 'Montaj module fotovoltaice',
      status: ProjectStatusEnum.CONSTRUCTION,
      startOffset: -10,
      endOffset: 10,
      workPackageCode: `${prefix}-WP-MOD`,
      workPackageName: 'Montaj module fotovoltaice',
    },
    {
      order: 3,
      name: 'Cablare si punere in functiune',
      status: ProjectStatusEnum.TESTING,
      startOffset: 1,
      endOffset: 12,
      workPackageCode: `${prefix}-WP-CAB`,
      workPackageName: 'Cablare DC/AC si testare',
    },
  ];
}

const TEAMS: TeamSeedDef[] = [
  {
    projectCode: 'AR-001',
    teamCode: 'AR-E1',
    teamName: 'Echipa Montaj Arad 1',
    zoneCode: 'Z1',
    zoneName: 'Zona 1 - Acoperis principal',
    leaderEmail: 'chef1@hiieko.com',
    foremanEmail: 'fore1@hiieko.com',
    memberEmails: ['chef1@hiieko.com', 'fore1@hiieko.com', 'wor1@hiieko.com', 'tech1@hiieko.com'],
    stages: stageSet('AR-001'),
    tasks: [
      {
        code: 'AR-001-T01',
        title: 'Montaj structura de prindere - acoperis principal',
        description: 'Montaj carlige, sine si cleme pe zona 1 (120 puncte de prindere).',
        status: TaskStatusEnum.COMPLETED,
        workPackageCode: 'AR-001-WP-STR',
        plannedStartOffset: -14,
        plannedEndOffset: -8,
        plannedQuantity: 120,
        unitOfMeasure: 'buc',
        actualQuantity: 120,
        actualStartOffset: -14,
        actualEndOffset: -8,
        assigneeEmails: ['chef1@hiieko.com', 'wor1@hiieko.com'],
        planTargetQuantity: 120,
        planCompleted: true,
      },
      {
        code: 'AR-001-T02',
        title: 'Montaj 120 module fotovoltaice 450 Wp',
        description: 'Montaj module pe structura existenta, zona 1, cu verificarea distantelor.',
        status: TaskStatusEnum.IN_PROGRESS,
        workPackageCode: 'AR-001-WP-MOD',
        plannedStartOffset: -6,
        plannedEndOffset: 2,
        plannedQuantity: 120,
        unitOfMeasure: 'buc',
        actualQuantity: 48,
        actualStartOffset: -6,
        assigneeEmails: ['wor1@hiieko.com', 'tech1@hiieko.com'],
        planTargetQuantity: 24,
        planCompleted: false,
      },
      {
        code: 'AR-001-T03',
        title: 'Cablare DC - 6 string-uri',
        description: 'Realizare cablare DC, legare string-uri si montaj string box.',
        status: TaskStatusEnum.READY,
        workPackageCode: 'AR-001-WP-CAB',
        plannedStartOffset: 1,
        plannedEndOffset: 5,
        plannedQuantity: 6,
        unitOfMeasure: 'buc',
        assigneeEmails: ['tech1@hiieko.com', 'fore1@hiieko.com'],
        planTargetQuantity: 2,
        planCompleted: false,
      },
      {
        code: 'AR-001-T04',
        title: 'Verificare izolatie si punere in functiune invertor',
        description: 'Masuratori de izolatie, verificare string-uri si PIF invertor.',
        status: TaskStatusEnum.PLANNED,
        workPackageCode: 'AR-001-WP-CAB',
        plannedStartOffset: 6,
        plannedEndOffset: 8,
        plannedQuantity: 1,
        unitOfMeasure: 'buc',
        assigneeEmails: ['fore1@hiieko.com', 'chef1@hiieko.com'],
        planTargetQuantity: 1,
        planCompleted: false,
      },
    ],
  },
  {
    projectCode: 'TM-002',
    teamCode: 'TM-E1',
    teamName: 'Echipa Montaj Timisoara 1',
    zoneCode: 'Z1',
    zoneName: 'Zona 1 - Hala productie',
    leaderEmail: 'chef2@hiieko.com',
    foremanEmail: 'fore2@hiieko.com',
    memberEmails: ['chef2@hiieko.com', 'fore2@hiieko.com', 'wor2@hiieko.com', 'tech2@hiieko.com'],
    stages: stageSet('TM-002'),
    tasks: [
      {
        code: 'TM-002-T01',
        title: 'Trasare si fixare sine de montaj',
        description: 'Trasare axe, fixare sine si verificare planeitate (85 m).',
        status: TaskStatusEnum.COMPLETED,
        workPackageCode: 'TM-002-WP-STR',
        plannedStartOffset: -12,
        plannedEndOffset: -6,
        plannedQuantity: 85,
        unitOfMeasure: 'm',
        actualQuantity: 85,
        actualStartOffset: -12,
        actualEndOffset: -6,
        assigneeEmails: ['chef2@hiieko.com', 'wor2@hiieko.com'],
        planTargetQuantity: 85,
        planCompleted: true,
      },
      {
        code: 'TM-002-T02',
        title: 'Montaj module fotovoltaice zona A',
        description: 'Montaj module in zona A (96 module) si stringare provizorie.',
        status: TaskStatusEnum.IN_PROGRESS,
        workPackageCode: 'TM-002-WP-MOD',
        plannedStartOffset: -5,
        plannedEndOffset: 3,
        plannedQuantity: 96,
        unitOfMeasure: 'buc',
        actualQuantity: 40,
        actualStartOffset: -5,
        assigneeEmails: ['wor2@hiieko.com', 'tech2@hiieko.com'],
        planTargetQuantity: 20,
        planCompleted: false,
      },
      {
        code: 'TM-002-T03',
        title: 'Montaj invertor si tablou AC',
        description: 'Fixare invertoare pe perete, montaj tablou AC si protectii.',
        status: TaskStatusEnum.READY,
        workPackageCode: 'TM-002-WP-CAB',
        plannedStartOffset: 2,
        plannedEndOffset: 6,
        plannedQuantity: 2,
        unitOfMeasure: 'buc',
        assigneeEmails: ['tech2@hiieko.com', 'fore2@hiieko.com'],
        planTargetQuantity: 1,
        planCompleted: false,
      },
      {
        code: 'TM-002-T04',
        title: 'Testare string-uri si masuratori I-V',
        description: 'Masuratori I-V pe string-uri, verificare tensiuni in gol si raport testare.',
        status: TaskStatusEnum.PLANNED,
        workPackageCode: 'TM-002-WP-CAB',
        plannedStartOffset: 7,
        plannedEndOffset: 9,
        plannedQuantity: 8,
        unitOfMeasure: 'buc',
        assigneeEmails: ['fore2@hiieko.com', 'chef2@hiieko.com'],
        planTargetQuantity: 4,
        planCompleted: false,
      },
    ],
  },
  {
    projectCode: 'CJ-003',
    teamCode: 'CJ-E1',
    teamName: 'Echipa Montaj Cluj 1',
    zoneCode: 'Z1',
    zoneName: 'Zona 1 - Acoperis hala',
    leaderEmail: 'chef3@hiieko.com',
    foremanEmail: 'fore3@hiieko.com',
    memberEmails: ['chef3@hiieko.com', 'fore3@hiieko.com', 'work3@hiieko.com', 'tech3@hiieko.com'],
    stages: stageSet('CJ-003'),
    tasks: [
      {
        code: 'CJ-003-T01',
        title: 'Montaj sistem de prindere (carlige + sine)',
        description: 'Montaj carlige si sine pentru 96 module, verificare etanseitate.',
        status: TaskStatusEnum.COMPLETED,
        workPackageCode: 'CJ-003-WP-STR',
        plannedStartOffset: -15,
        plannedEndOffset: -9,
        plannedQuantity: 96,
        unitOfMeasure: 'buc',
        actualQuantity: 96,
        actualStartOffset: -15,
        actualEndOffset: -9,
        assigneeEmails: ['chef3@hiieko.com', 'work3@hiieko.com'],
        planTargetQuantity: 96,
        planCompleted: true,
      },
      {
        code: 'CJ-003-T02',
        title: 'Montaj 96 module fotovoltaice',
        description: 'Montaj module pe structura si controlul cuplului de strangere.',
        status: TaskStatusEnum.IN_PROGRESS,
        workPackageCode: 'CJ-003-WP-MOD',
        plannedStartOffset: -7,
        plannedEndOffset: 1,
        plannedQuantity: 96,
        unitOfMeasure: 'buc',
        actualQuantity: 52,
        actualStartOffset: -7,
        assigneeEmails: ['work3@hiieko.com', 'tech3@hiieko.com'],
        planTargetQuantity: 16,
        planCompleted: false,
      },
      {
        code: 'CJ-003-T03',
        title: 'Cablare DC si montaj string box',
        description: 'Trasare cabluri DC in jgheaburi, montaj string box si legaturi.',
        status: TaskStatusEnum.PLANNED,
        workPackageCode: 'CJ-003-WP-CAB',
        plannedStartOffset: 2,
        plannedEndOffset: 6,
        plannedQuantity: 80,
        unitOfMeasure: 'm',
        assigneeEmails: ['tech3@hiieko.com', 'fore3@hiieko.com'],
        planTargetQuantity: 20,
        planCompleted: false,
      },
      {
        code: 'CJ-003-T04',
        title: 'Racordare la retea - verificare finala',
        description: 'Verificari electrice finale, probe si pregatire documentatie de racordare.',
        status: TaskStatusEnum.PLANNED,
        workPackageCode: 'CJ-003-WP-CAB',
        plannedStartOffset: 8,
        plannedEndOffset: 11,
        plannedQuantity: 1,
        unitOfMeasure: 'buc',
        assigneeEmails: ['chef3@hiieko.com', 'fore3@hiieko.com'],
        planTargetQuantity: 1,
        planCompleted: false,
      },
    ],
  },
];

// ============================================================================
// Helpers
// ============================================================================

/** Today's calendar date (UTC convention used by the API) at 00:00Z. */
function todayUtcMidnight(): Date {
  const iso = new Date().toISOString().split('T')[0];
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date-time `days` away from today at 08:00 local — used for plan dates. */
function offsetDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(8, 0, 0, 0);
  return d;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: refusing to seed development accounts against production.');
    process.exit(1);
  }

  console.log('='.repeat(78));
  console.log('  HIIEKO — development accounts / teams / projects / tasks seed');
  console.log('='.repeat(78));
  console.log('');

  // ── Organization ────────────────────────────────────────────────────────
  const organization =
    (await prisma.organization.findFirst({ where: { name: ORG_NAME } })) ??
    (await prisma.organization.findFirst({ orderBy: { created_at: 'asc' } }));

  if (!organization) {
    console.error('ERROR: no organization found. Run `npm run seed --workspace=backend` first.');
    process.exit(1);
  }
  console.log(`Organization: ${organization.name} (${organization.id})`);

  // ── Projects (matched by code — never duplicated) ────────────────────────
  const projectCodes = TEAMS.map((t) => t.projectCode);
  const projects = await prisma.project.findMany({
    where: { code: { in: projectCodes } },
    select: { id: true, code: true, name: true },
  });
  const missing = projectCodes.filter((code) => !projects.some((p) => p.code === code));
  if (missing.length > 0) {
    console.error(`ERROR: projects not found by code: ${missing.join(', ')}`);
    process.exit(1);
  }
  const projectByCode = new Map(projects.map((p) => [p.code, p]));
  console.log(`Projects:     ${projects.map((p) => `${p.code} "${p.name}"`).join(' | ')}`);
  console.log('');

  // ── 1. Accounts (+ profile + employee) ──────────────────────────────────
  console.log('[1/6] Accounts (users + profiles + employees)...');
  const userIdByEmail = new Map<string, string>();

  for (const account of ACCOUNTS) {
    const email = account.email.toLowerCase();
    const passwordHash = await bcrypt.hash(account.password, SALT_ROUNDS);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password_hash: passwordHash,
        role: account.role,
        is_active: true,
        organization_id: organization.id,
      },
      create: {
        email,
        password_hash: passwordHash,
        role: account.role,
        is_active: true,
        organization_id: organization.id,
      },
    });

    await prisma.userProfile.upsert({
      where: { user_id: user.id },
      update: {
        full_name: account.fullName,
        phone: account.phone,
        employee_code: account.employeeCode,
      },
      create: {
        user_id: user.id,
        full_name: account.fullName,
        phone: account.phone,
        employee_code: account.employeeCode,
        language: 'ro',
      },
    });

    const { firstName, lastName } = splitName(account.fullName);
    await prisma.employee.upsert({
      where: { user_id: user.id },
      update: {
        first_name: firstName,
        last_name: lastName,
        position: account.position,
        hourly_rate: account.hourlyRate,
        is_active: true,
      },
      create: {
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        position: account.position,
        hourly_rate: account.hourlyRate,
        is_active: true,
      },
    });

    userIdByEmail.set(email, user.id);
    console.log(`      ${account.email.padEnd(22)} ${account.role.padEnd(12)} ${account.fullName}`);
  }

  // ── 2. Per project: membership, team, stages, tasks, daily plan ─────────
  const stats = { members: 0, teams: 0, teamMembers: 0, stages: 0, workPackages: 0, zones: 0, tasks: 0, assignments: 0, plans: 0, planTasks: 0 };
  const planDate = todayUtcMidnight();

  for (const teamDef of TEAMS) {
    const project = projectByCode.get(teamDef.projectCode)!;
    const leaderId = userIdByEmail.get(teamDef.leaderEmail.toLowerCase())!;

    console.log('');
    console.log(`[2/6] ${project.code} "${project.name}" → team ${teamDef.teamCode}`);

    // 2a. ProjectMember for every roster account (API visibility + task assignment integrity)
    for (const email of teamDef.memberEmails) {
      const account = ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())!;
      const userId = userIdByEmail.get(email.toLowerCase())!;
      await prisma.projectMember.upsert({
        where: { project_id_user_id: { project_id: project.id, user_id: userId } },
        update: { role: account.role },
        create: { project_id: project.id, user_id: userId, role: account.role },
      });
      stats.members++;
    }
    console.log(`      project members: ${teamDef.memberEmails.join(', ')}`);

    // 2b. Team (one per project) + roster
    const team = await prisma.team.upsert({
      where: { code: teamDef.teamCode },
      update: {
        name: teamDef.teamName,
        leader_id: leaderId,
        project_id: project.id,
        is_active: true,
      },
      create: {
        code: teamDef.teamCode,
        name: teamDef.teamName,
        leader_id: leaderId,
        project_id: project.id,
        is_active: true,
      },
    });
    stats.teams++;

    for (const email of teamDef.memberEmails) {
      const userId = userIdByEmail.get(email.toLowerCase())!;
      await prisma.teamMember.upsert({
        where: { team_id_user_id: { team_id: team.id, user_id: userId } },
        update: {},
        create: { team_id: team.id, user_id: userId },
      });
      stats.teamMembers++;
    }
    console.log(`      team: ${team.code} | leader: ${teamDef.leaderEmail} | foreman: ${teamDef.foremanEmail} | roster: ${teamDef.memberEmails.length}`);

    // 2c. Stages + work packages
    const workPackageIdByCode = new Map<string, string>();
    for (const stageDef of teamDef.stages) {
      const stage = await prisma.projectStage.upsert({
        where: { project_id_stage_order: { project_id: project.id, stage_order: stageDef.order } },
        update: {
          name: stageDef.name,
          status: stageDef.status,
          start_date: offsetDate(stageDef.startOffset),
          end_date: offsetDate(stageDef.endOffset),
        },
        create: {
          project_id: project.id,
          stage_order: stageDef.order,
          name: stageDef.name,
          status: stageDef.status,
          start_date: offsetDate(stageDef.startOffset),
          end_date: offsetDate(stageDef.endOffset),
        },
      });
      stats.stages++;

      const existingWp = await prisma.workPackage.findFirst({
        where: { stage_id: stage.id, code: stageDef.workPackageCode },
        select: { id: true },
      });
      const workPackage = existingWp
        ? await prisma.workPackage.update({
            where: { id: existingWp.id },
            data: { name: stageDef.workPackageName },
          })
        : await prisma.workPackage.create({
            data: {
              stage_id: stage.id,
              code: stageDef.workPackageCode,
              name: stageDef.workPackageName,
            },
          });
      workPackageIdByCode.set(stageDef.workPackageCode, workPackage.id);
      stats.workPackages++;
    }

    // 2d. Work zone
    const zone = await prisma.locationZone.upsert({
      where: { project_id_code: { project_id: project.id, code: teamDef.zoneCode } },
      update: { name: teamDef.zoneName },
      create: { project_id: project.id, code: teamDef.zoneCode, name: teamDef.zoneName },
    });
    stats.zones++;

    // 2e. Tasks + assignments
    const taskIdByCode = new Map<string, string>();
    for (const taskDef of teamDef.tasks) {
      const task = await prisma.task.upsert({
        where: { project_id_code: { project_id: project.id, code: taskDef.code } },
        update: {
          title: taskDef.title,
          description: taskDef.description,
          status: taskDef.status,
          work_package_id: workPackageIdByCode.get(taskDef.workPackageCode),
          zone_id: zone.id,
          planned_start: offsetDate(taskDef.plannedStartOffset),
          planned_end: offsetDate(taskDef.plannedEndOffset),
          planned_quantity: taskDef.plannedQuantity,
          unit_of_measure: taskDef.unitOfMeasure,
          actual_quantity: taskDef.actualQuantity,
        },
        create: {
          project_id: project.id,
          work_package_id: workPackageIdByCode.get(taskDef.workPackageCode),
          zone_id: zone.id,
          code: taskDef.code,
          title: taskDef.title,
          description: taskDef.description,
          status: taskDef.status,
          planned_start: offsetDate(taskDef.plannedStartOffset),
          planned_end: offsetDate(taskDef.plannedEndOffset),
          planned_quantity: taskDef.plannedQuantity,
          unit_of_measure: taskDef.unitOfMeasure,
          actual_quantity: taskDef.actualQuantity,
          actual_start: taskDef.actualStartOffset !== undefined ? offsetDate(taskDef.actualStartOffset) : undefined,
          actual_end: taskDef.actualEndOffset !== undefined ? offsetDate(taskDef.actualEndOffset) : undefined,
        },
      });
      taskIdByCode.set(taskDef.code, task.id);
      stats.tasks++;

      for (const email of taskDef.assigneeEmails) {
        const userId = userIdByEmail.get(email.toLowerCase())!;
        await prisma.taskAssignment.upsert({
          where: { task_id_user_id: { task_id: task.id, user_id: userId } },
          update: {},
          create: { task_id: task.id, user_id: userId },
        });
        stats.assignments++;
      }
      console.log(`      task ${taskDef.code} [${taskDef.status}] → ${taskDef.assigneeEmails.join(', ')}`);
    }

    // 2f. Today's PUBLISHED daily plan (worker "my day" + /planning)
    const existingPlan = await prisma.dailyPlan.findFirst({
      where: { project_id: project.id, plan_date: planDate, team_id: team.id },
      select: { id: true },
    });
    const planNotes = `Plan de lucru zilnic — ${teamDef.teamName}`;
    const plan = existingPlan
      ? await prisma.dailyPlan.update({
          where: { id: existingPlan.id },
          data: { status: DailyPlanStatusEnum.PUBLISHED, notes: planNotes, created_by: leaderId },
        })
      : await prisma.dailyPlan.create({
          data: {
            project_id: project.id,
            team_id: team.id,
            plan_date: planDate,
            status: DailyPlanStatusEnum.PUBLISHED,
            notes: planNotes,
            created_by: leaderId,
          },
        });
    stats.plans++;

    for (const taskDef of teamDef.tasks) {
      const taskId = taskIdByCode.get(taskDef.code)!;
      await prisma.dailyPlanTask.upsert({
        where: { daily_plan_id_task_id: { daily_plan_id: plan.id, task_id: taskId } },
        update: {
          target_quantity: taskDef.planTargetQuantity,
          actual_quantity: taskDef.actualQuantity,
          completed: taskDef.planCompleted,
        },
        create: {
          daily_plan_id: plan.id,
          task_id: taskId,
          target_quantity: taskDef.planTargetQuantity,
          actual_quantity: taskDef.actualQuantity,
          completed: taskDef.planCompleted,
        },
      });
      stats.planTasks++;
    }
  }

  // ── 3. Summary ──────────────────────────────────────────────────────────
  const totalUsers = await prisma.user.count();
  const totalProjects = await prisma.project.count({ where: { is_active: true } });
  const totalTeams = await prisma.team.count({ where: { is_active: true } });
  const totalTasks = await prisma.task.count();

  console.log('');
  console.log('='.repeat(78));
  console.log('  SEED SUMMARY');
  console.log('='.repeat(78));
  console.log(`  project memberships written : ${stats.members}`);
  console.log(`  teams written               : ${stats.teams}`);
  console.log(`  team members written        : ${stats.teamMembers}`);
  console.log(`  stages / work packages      : ${stats.stages} / ${stats.workPackages}`);
  console.log(`  zones                       : ${stats.zones}`);
  console.log(`  tasks / assignments         : ${stats.tasks} / ${stats.assignments}`);
  console.log(`  daily plans / plan tasks    : ${stats.plans} / ${stats.planTasks}  (plan_date ${planDate.toISOString().split('T')[0]})`);
  console.log('');
  console.log(`  DB totals → users: ${totalUsers} | active projects: ${totalProjects} | active teams: ${totalTeams} | tasks: ${totalTasks}`);

  console.log('');
  console.log('='.repeat(78));
  console.log('  DEVELOPMENT LOGIN ACCOUNTS  (web: /login  |  API: POST /api/auth/login)');
  console.log('='.repeat(78));
  console.log('  ROLE          EMAIL                   PASSWORD     NAME                PROJECT / TEAM');
  console.log('  ' + '-'.repeat(74));
  for (const account of ACCOUNTS) {
    const teamDef = TEAMS.find((t) => t.teamCode === account.teamCode)!;
    console.log(
      `  ${account.role.padEnd(13)} ${account.email.padEnd(21)} ${account.password.padEnd(12)} ${account.fullName.padEnd(19)} ${teamDef.projectCode} / ${teamDef.teamCode}`,
    );
  }
  console.log('');
  console.log('  DEVELOPMENT ONLY — never use these credentials in production.');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });