/**
 * HIIEKO — full realistic demo dataset.
 *
 * Goal: every page has data and every role sees something meaningful.
 *
 * IDEMPOTENT. Every write is either an upsert on a natural unique key
 * (users by email, projects by code, materials by code, ...) or an upsert
 * keyed on a stable demo id via `upsertById` (see seed-helpers.ts). Running
 * the seed twice must neither fail nor duplicate rows.
 *
 * NOTE: this is DEVELOPMENT-ONLY demo data. Never run in production.
 */

import { PrismaClient } from '@prisma/client';
import {
  AttendanceStatusEnum,
  AvizStatusEnum,
  ChangeOrderStatusEnum,
  DailyPlanStatusEnum,
  DependencyTypeEnum,
  DocumentTypeEnum,
  ExpenseCategoryEnum,
  ExpenseStatusEnum,
  IssueSeverityEnum,
  IssueStatusEnum,
  NCRStatusEnum,
  NotificationPriorityEnum,
  OhsRiskType,
  PaymentMethodEnum,
  ProjectStatusEnum,
  SolarDesignStatusEnum,
  SolarModuleOrientationEnum,
  SolarRoofTypeEnum,
  SolarSurfaceTypeEnum,
  StockMovementTypeEnum,
  TaskStatusEnum,
} from '@prisma/client';
import {
  addMinutes,
  at,
  dateOnly,
  did,
  hoursAgo,
  isWeekend,
  pick,
  upsertById,
} from './seed-helpers';

const EMAILS: Record<string, string> = {
  admin: 'dev@hiieko.local',
  owner: 'owner@hiieko.local',
  manager: 'manager@hiieko.local',
  pm: 'pm@hiieko.local',
  siteManager: 'site.manager@hiieko.local',
  foreman: 'foreman@hiieko.local',
  qa: 'qa@hiieko.local',
  finance: 'finance@hiieko.local',
  procurement: 'procurement@hiieko.local',
  viewer: 'viewer@hiieko.local',
  leaderIon: 'ion.munteanu@hiieko.local',
  leaderMaria: 'maria.popescu@hiieko.local',
  leaderAndrei: 'andrei.popovici@hiieko.local',
  workerCostin: 'costin.dumitrescu@hiieko.local',
  workerRamona: 'ramona.popa@hiieko.local',
  workerDaniel: 'daniel.georgescu@hiieko.local',
  workerIoana: 'ioana.niculescu@hiieko.local',
  workerAlex: 'alexandru.ivan@hiieko.local',
};

const TASK_NAMES = [
  'Montaj structura de prindere - acoperis principal',
  'Cablare DC - 6 string-uri',
  'Instalare invertoare',
  'Montaj module fotovoltaice',
  'Conexiuni AC tablou principal',
  'Săpătură cabluri DC',
  'Montaj sistem de monitorizare',
  'Testare izolație DC',
  'Fixare cable tray',
  'Împământare structuri',
  'Instalare cutii de joncțiune',
  'Montaj contoare',
  'Verificare MPPT',
  'Racordare la rețea',
  'Montaj panouri de protecție',
];

const TASK_STATUSES: TaskStatusEnum[] = [
  TaskStatusEnum.PLANNED,
  TaskStatusEnum.PLANNED,
  TaskStatusEnum.PLANNED,
  TaskStatusEnum.IN_PROGRESS,
  TaskStatusEnum.IN_PROGRESS,
  TaskStatusEnum.IN_PROGRESS,
  TaskStatusEnum.IN_PROGRESS,
  TaskStatusEnum.IN_PROGRESS,
  TaskStatusEnum.COMPLETED,
  TaskStatusEnum.COMPLETED,
  TaskStatusEnum.COMPLETED,
  TaskStatusEnum.VERIFIED,
  TaskStatusEnum.VERIFIED,
  TaskStatusEnum.BLOCKED,
  TaskStatusEnum.BLOCKED,
];

const ISSUE_TITLES = [
  'Lipsă cablu 6mm² pentru string-uri 4-6',
  'Structură metalică nealiniată zona B',
  'Modul spart la livrare',
  'Întârziere livrare invertoare',
  'Cablaj DC neconform cu proiectul',
  'Lipsă autorizație ISU',
  'Muncitor fără certificare electrică',
  'Acoperiș deteriorat la montaj',
  'Protecție insuficientă la cutii joncțiune',
  'Conexiune AC instabilă',
  'Termen livrare module depășit',
  'Inspectie QA eșuată la zona C',
];

const ISSUE_SEVERITIES: IssueSeverityEnum[] = [
  IssueSeverityEnum.CRITICAL,
  IssueSeverityEnum.HIGH,
  IssueSeverityEnum.CRITICAL,
  IssueSeverityEnum.HIGH,
  IssueSeverityEnum.HIGH,
  IssueSeverityEnum.MEDIUM,
  IssueSeverityEnum.MEDIUM,
  IssueSeverityEnum.MEDIUM,
  IssueSeverityEnum.MEDIUM,
  IssueSeverityEnum.LOW,
  IssueSeverityEnum.LOW,
  IssueSeverityEnum.LOW,
];

const ISSUE_STATUSES: IssueStatusEnum[] = [
  IssueStatusEnum.OPEN,
  IssueStatusEnum.OPEN,
  IssueStatusEnum.OPEN,
  IssueStatusEnum.OPEN,
  IssueStatusEnum.INVESTIGATING,
  IssueStatusEnum.INVESTIGATING,
  IssueStatusEnum.INVESTIGATING,
  IssueStatusEnum.RESOLVED,
  IssueStatusEnum.RESOLVED,
  IssueStatusEnum.RESOLVED,
  IssueStatusEnum.RESOLVED,
  IssueStatusEnum.CLOSED,
];

const MATERIALS = [
  { code: 'MAT-DC6', name: 'Cablu DC 6mm²', unit: 'm', category: 'Cablu', threshold: 200, cost: 8.5 },
  { code: 'MAT-AC4X25', name: 'Cablu AC 4x25mm²', unit: 'm', category: 'Cablu', threshold: 300, cost: 42 },
  { code: 'MAT-MOD500', name: 'Modul 500W', unit: 'buc', category: 'Module', threshold: 100, cost: 780 },
  { code: 'MAT-PROF4M', name: 'Profil aluminiu 4m', unit: 'buc', category: 'Structura', threshold: 250, cost: 95 },
  { code: 'MAT-SURUBM8', name: 'Șurub inox M8', unit: 'buc', category: 'Fixare', threshold: 1000, cost: 1.2 },
  { code: 'MAT-MC4', name: 'Conector MC4', unit: 'buc', category: 'Conectica', threshold: 300, cost: 6.5 },
  { code: 'MAT-INV25', name: 'Invertor 25kW', unit: 'buc', category: 'Echipament', threshold: 10, cost: 9200 },
  { code: 'MAT-CJDC', name: 'Cutie joncțiune DC', unit: 'buc', category: 'Conectica', threshold: 50, cost: 180 },
];

type MovementSpec = {
  material: string;
  type: StockMovementTypeEnum;
  qty: number;
  from?: string;
  to?: string;
  project?: string;
  note?: string;
};

const OPENINGS: Record<string, number> = {
  'MAT-DC6': 2000,
  'MAT-AC4X25': 800,
  'MAT-MOD500': 600,
  'MAT-PROF4M': 1200,
  'MAT-SURUBM8': 5000,
  'MAT-MC4': 1200,
  'MAT-INV25': 40,
  'MAT-CJDC': 300,
};

const CONSUMPTIONS: Array<[string, number]> = [
  ['MAT-DC6', 900],
  ['MAT-DC6', 500],
  ['MAT-DC6', 450],
  ['MAT-AC4X25', 200],
  ['MAT-AC4X25', 200],
  ['MAT-MOD500', 300],
  ['MAT-MOD500', 240],
  ['MAT-PROF4M', 500],
  ['MAT-PROF4M', 400],
  ['MAT-SURUBM8', 2000],
  ['MAT-MC4', 600],
  ['MAT-MC4', 550],
  ['MAT-INV25', 12],
  ['MAT-CJDC', 200],
  ['MAT-CJDC', 60],
];

const TRANSFERS: Array<[string, number]> = [
  ['MAT-DC6', 100],
  ['MAT-PROF4M', 200],
  ['MAT-MC4', 150],
  ['MAT-MOD500', 50],
  ['MAT-SURUBM8', 500],
];

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  console.log();
  console.log('========================================');
  console.log('DEMO ENVIRONMENT (all roles / all pages)');
  console.log('========================================');

  // ---------------------------------------------------------------------------
  // 0. Organization + users
  // ---------------------------------------------------------------------------
  const org = await prisma.organization.findFirst({
    where: { name: 'HIIEKO Development' },
  });
  if (!org) throw new Error('Organization "HIIEKO Development" not found — run seed.ts first.');
  const orgId = org.id;

  const userRows = await prisma.user.findMany({
    where: { email: { in: Object.values(EMAILS) } },
  });
  const byEmail = new Map(userRows.map((u) => [u.email, u]));
  const U = (key: string) => {
    const user = byEmail.get(EMAILS[key]);
    if (!user) throw new Error(`Seed user not found: ${EMAILS[key]}`);
    return user;
  };

  console.log('[demo 1/12] clients + projects + zones + teams');

  // ---------------------------------------------------------------------------
  // 1. Clients
  // ---------------------------------------------------------------------------
  const clientArad = await upsertById(prisma.client, did('client', 'arad'), {
    organization_id: orgId,
    name: 'Primăria Municipiului Arad',
    cui: 'DEMO-CUI-ARAD',
    contact_person: 'Andrei Lazăr',
    contact_email: 'contact@primaria-arad.demo',
    contact_phone: '+40 257 000 001',
  });
  const clientTm = await upsertById(prisma.client, did('client', 'timisoara'), {
    organization_id: orgId,
    name: 'Primăria Municipiului Timișoara',
    cui: 'DEMO-CUI-TM',
    contact_person: 'Raluca Bălan',
    contact_email: 'contact@primaria-tm.demo',
    contact_phone: '+40 256 000 002',
  });

  // ---------------------------------------------------------------------------
  // 2. Projects
  // ---------------------------------------------------------------------------
  const arad = await prisma.project.upsert({
    where: { code: 'AR-001' },
    update: {
      name: 'Parc Solar Arad',
      address: 'Calea Aradului 100, Arad',
      latitude: 46.17,
      longitude: 21.32,
      installed_capacity_mwp: 5.4,
      status: ProjectStatusEnum.CONSTRUCTION,
      start_date: at(120, 8, 0),
      target_end_date: at(-30, 17, 0),
      budget_total: 12500000,
      currency: 'RON',
      client_id: clientArad.id,
      is_active: true,
    },
    create: {
      organization_id: orgId,
      client_id: clientArad.id,
      name: 'Parc Solar Arad',
      code: 'AR-001',
      address: 'Calea Aradului 100, Arad',
      latitude: 46.17,
      longitude: 21.32,
      installed_capacity_mwp: 5.4,
      status: ProjectStatusEnum.CONSTRUCTION,
      start_date: at(120, 8, 0),
      target_end_date: at(-30, 17, 0),
      budget_total: 12500000,
      currency: 'RON',
    },
  });
  const timisoara = await prisma.project.upsert({
    where: { code: 'TM-002' },
    update: {
      name: 'Parc Solar Timisoara',
      address: 'Str. Energiei 12, Timișoara',
      latitude: 45.75,
      longitude: 21.23,
      installed_capacity_mwp: 3.2,
      status: ProjectStatusEnum.COMPLETED,
      start_date: at(300, 8, 0),
      target_end_date: at(30, 17, 0),
      budget_total: 7800000,
      currency: 'RON',
      client_id: clientTm.id,
      is_active: true,
    },
    create: {
      organization_id: orgId,
      client_id: clientTm.id,
      name: 'Parc Solar Timisoara',
      code: 'TM-002',
      address: 'Str. Energiei 12, Timișoara',
      latitude: 45.75,
      longitude: 21.23,
      installed_capacity_mwp: 3.2,
      status: ProjectStatusEnum.COMPLETED,
      start_date: at(300, 8, 0),
      target_end_date: at(30, 17, 0),
      budget_total: 7800000,
      currency: 'RON',
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Location zones (3 per project)
  // ---------------------------------------------------------------------------
  const zoneDefs = ['Zone A', 'Zone B', 'Zone C'];
  const zones: Record<string, any[]> = { arad: [], timisoara: [] };
  for (const [key, project, prefix] of [
    ['arad', arad, 'AR'],
    ['timisoara', timisoara, 'TM'],
  ] as const) {
    for (let i = 0; i < zoneDefs.length; i++) {
      const code = `${prefix}-Z${'ABC'[i]}`;
      const zone = await prisma.locationZone.upsert({
        where: { project_id_code: { project_id: project.id, code } },
        update: { name: zoneDefs[i] },
        create: {
          project_id: project.id,
          name: zoneDefs[i],
          code,
          coordinates: { lat: Number(project.latitude) + i * 0.001, lng: Number(project.longitude) + i * 0.001 },
        },
      });
      zones[key].push(zone);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Teams + members
  // ---------------------------------------------------------------------------
  const teamDefs = [
    { key: 'arad-main', project: arad, name: 'Echipa Montaj 1', code: 'AR-TM1', leader: 'leaderIon', workers: ['workerCostin', 'workerRamona'] },
    { key: 'arad-elec', project: arad, name: 'Echipa Electricieni', code: 'AR-TE1', leader: 'leaderMaria', workers: ['workerDaniel', 'workerIoana'] },
    { key: 'tm-main', project: timisoara, name: 'Echipa Montaj 2', code: 'TM-TM1', leader: 'leaderAndrei', workers: ['workerAlex', 'workerCostin'] },
    { key: 'tm-finish', project: timisoara, name: 'Echipa Finalizare', code: 'TM-TF1', leader: 'foreman', workers: ['workerRamona', 'workerIoana'] },
  ];
  const teams: Record<string, any> = {};
  for (const def of teamDefs) {
    const team = await prisma.team.upsert({
      where: { code: def.code },
      update: { name: def.name, leader_id: U(def.leader).id, project_id: def.project.id, is_active: true },
      create: {
        name: def.name,
        code: def.code,
        leader_id: U(def.leader).id,
        project_id: def.project.id,
      },
    });
    teams[def.key] = team;

    const memberKeys = [def.leader, ...def.workers];
    for (const mk of memberKeys) {
      await prisma.teamMember.upsert({
        where: { team_id_user_id: { team_id: team.id, user_id: U(mk).id } },
        update: {},
        create: { team_id: team.id, user_id: U(mk).id },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Project members (PM, Site Manager, Foreman, leaders, workers)
  // ---------------------------------------------------------------------------
  const memberDefs: Array<[any, string[]]> = [
    [arad, ['pm', 'siteManager', 'foreman', 'manager', 'leaderIon', 'leaderMaria', 'workerCostin', 'workerRamona', 'workerDaniel', 'workerIoana']],
    [timisoara, ['pm', 'siteManager', 'foreman', 'manager', 'leaderAndrei', 'workerAlex']],
  ];
  for (const [project, keys] of memberDefs) {
    for (const key of keys) {
      const user = U(key);
      await prisma.projectMember.upsert({
        where: { project_id_user_id: { project_id: project.id, user_id: user.id } },
        update: { role: user.role },
        create: { project_id: project.id, user_id: user.id, role: user.role },
      });
    }
  }

  console.log('[demo 2/12] tasks + dependencies');

  // ---------------------------------------------------------------------------
  // 6. Tasks (15 per project) + assignments + dependencies
  // ---------------------------------------------------------------------------
  const projectDefs = [
    { key: 'arad', project: arad, prefix: 'AR', zones: zones.arad, teamKeys: ['arad-main', 'arad-elec'] },
    { key: 'timisoara', project: timisoara, prefix: 'TM', zones: zones.timisoara, teamKeys: ['tm-main', 'tm-finish'] },
  ];
  const tasksByProject: Record<string, any[]> = { arad: [], timisoara: [] };
  const assigneePool = ['workerCostin', 'workerRamona', 'workerDaniel', 'workerIoana', 'workerAlex', 'leaderIon', 'leaderMaria', 'leaderAndrei'];

  for (const pd of projectDefs) {
    for (let i = 0; i < TASK_NAMES.length; i++) {
      const status = TASK_STATUSES[i];
      const code = `${pd.prefix}-T${String(i + 1).padStart(2, '0')}`;
      const zone = pick(pd.zones, i);
      const plannedQty = [40, 6, 4, 120, 8, 200, 1, 6, 80, 30, 12, 4, 6, 1, 20][i];

      const data: Record<string, any> = {
        project_id: pd.project.id,
        zone_id: zone.id,
        title: TASK_NAMES[i],
        code,
        description: `${TASK_NAMES[i]} — ${zone.name}`,
        status,
        planned_quantity: plannedQty,
        unit_of_measure: ['mp', 'buc', 'buc', 'buc', 'buc', 'mp', 'buc', 'string', 'mp', 'buc', 'buc', 'buc', 'string', 'buc', 'buc'][i],
        planned_start: at(i + 3, 8, 0),
        planned_end: at(i - 1, 17, 0),
      };

      if (status === TaskStatusEnum.PLANNED) {
        data.planned_start = at(-1 * (i + 1), 8, 0);
        data.planned_end = at(-1 * (i + 3), 17, 0);
      } else if (status === TaskStatusEnum.IN_PROGRESS) {
        data.planned_start = at(i + 2, 8, 0);
        data.planned_end = at(-3, 17, 0);
        data.actual_start = at(i + 2, 8, 10);
        data.actual_quantity = Math.round(plannedQty * 0.45);
      } else if (status === TaskStatusEnum.COMPLETED || status === TaskStatusEnum.VERIFIED) {
        data.planned_start = at(i + 15, 8, 0);
        data.planned_end = at(i + 11, 17, 0);
        data.actual_start = at(i + 15, 8, 15);
        data.actual_end = at(i + 11, 16, 30);
        data.actual_quantity = plannedQty;
      } else if (status === TaskStatusEnum.BLOCKED) {
        data.planned_start = at(i + 10, 8, 0);
        data.planned_end = at(i - 4, 17, 0);
        data.blocked_reason = i === 13 ? 'Lipsă cablu DC' : 'Așteptăm autorizație';
        data.blocked_at = at(2, 10, 0);
      }
      if (status === TaskStatusEnum.VERIFIED) {
        data.verified_by = U('qa').id;
        data.verified_at = at(i + 10, 12, 0);
      }

      const task = await prisma.task.upsert({
        where: { project_id_code: { project_id: pd.project.id, code } },
        update: data as any,
        create: data as any,
      });
      tasksByProject[pd.key].push(task);

      const assignee = U(assigneePool[i % assigneePool.length]);
      await prisma.taskAssignment.upsert({
        where: { task_id_user_id: { task_id: task.id, user_id: assignee.id } },
        update: {},
        create: { task_id: task.id, user_id: assignee.id },
      });
    }
  }

  const dependencyDefs: Array<[string, number, number]> = [
    ['arad', 0, 1],
    ['arad', 1, 2],
    ['arad', 3, 4],
    ['arad', 7, 8],
    ['arad', 10, 11],
    ['arad', 1, 2],
    ['timisoara', 0, 1],
    ['timisoara', 2, 3],
    ['timisoara', 4, 5],
  ];
  const seenDeps = new Set<string>();
  for (const [key, from, to] of dependencyDefs) {
    const list = tasksByProject[key];
    const predecessor = list[from];
    const successor = list[to];
    const depKey = `${predecessor.id}|${successor.id}`;
    if (seenDeps.has(depKey)) continue;
    seenDeps.add(depKey);
    await prisma.taskDependency.upsert({
      where: {
        predecessor_task_id_successor_task_id: {
          predecessor_task_id: predecessor.id,
          successor_task_id: successor.id,
        },
      },
      update: { dependency_type: DependencyTypeEnum.FINISH_TO_START, lag_days: 0 },
      create: {
        predecessor_task_id: predecessor.id,
        successor_task_id: successor.id,
        dependency_type: DependencyTypeEnum.FINISH_TO_START,
        lag_days: 0,
      },
    });
  }

  console.log('[demo 3/12] daily plans');

  // ---------------------------------------------------------------------------
  // 7. Daily plans (7 days back, 1 plan per team per day, 3 tasks each)
  // ---------------------------------------------------------------------------
  const planStatusByDay: DailyPlanStatusEnum[] = [
    DailyPlanStatusEnum.DRAFT,
    DailyPlanStatusEnum.PUBLISHED,
    DailyPlanStatusEnum.PUBLISHED,
    DailyPlanStatusEnum.COMPLETED,
    DailyPlanStatusEnum.COMPLETED,
    DailyPlanStatusEnum.CANCELLED,
    DailyPlanStatusEnum.COMPLETED,
  ];
  for (const pd of projectDefs) {
    const list = tasksByProject[pd.key];
    for (let day = 0; day < 7; day++) {
      for (let t = 0; t < pd.teamKeys.length; t++) {
        const team = teams[pd.teamKeys[t]];
        const plan = await upsertById(prisma.dailyPlan, did('plan', pd.prefix, day, t), {
          project_id: pd.project.id,
          team_id: team.id,
          plan_date: dateOnly(day),
          status: planStatusByDay[day],
          notes: `Plan ${pd.project.name} — ${team.name}`,
          created_by: U(t === 0 ? 'leaderIon' : 'leaderMaria').id,
        });
        for (let k = 0; k < 3; k++) {
          const task = list[(day * 2 + t + k) % list.length];
          const completed = planStatusByDay[day] === DailyPlanStatusEnum.COMPLETED;
          await prisma.dailyPlanTask.upsert({
            where: { daily_plan_id_task_id: { daily_plan_id: plan.id, task_id: task.id } },
            update: {
              target_quantity: 10,
              actual_quantity: completed ? 10 : null,
              completed,
            },
            create: {
              daily_plan_id: plan.id,
              task_id: task.id,
              target_quantity: 10,
              actual_quantity: completed ? 10 : null,
              completed,
            },
          });
        }
      }
    }
  }

  console.log('[demo 4/12] attendance');

  // ---------------------------------------------------------------------------
  // 8. Attendance (~30 records over the last week, weekdays only)
  // ---------------------------------------------------------------------------
  const attendanceStaff = ['workerCostin', 'workerRamona', 'workerDaniel', 'workerIoana', 'workerAlex', 'leaderIon'];
  const attendanceSpecs: Array<{ key: string; day: number; idx: number }> = [];
  for (let day = 0; day < 7 && attendanceSpecs.length < 30; day++) {
    if (isWeekend(dateOnly(day))) continue;
    for (const key of attendanceStaff) {
      if (attendanceSpecs.length >= 30) break;
      attendanceSpecs.push({ key, day, idx: attendanceSpecs.length });
    }
  }
  const attendanceIds: string[] = [];
  let correctionMade = false;
  for (const spec of attendanceSpecs) {
    const user = U(spec.key);
    const isTm = spec.key === 'workerAlex';
    const project = isTm ? timisoara : arad;
    const inTotal = 7 * 60 + 45 + (spec.idx * 2) % 31;
    const missOut = spec.idx === spec.idx && attendanceSpecs.indexOf(spec) === 7;
    const overtime = attendanceSpecs.indexOf(spec) === 3 || attendanceSpecs.indexOf(spec) === 11;
    const outTotal = overtime
      ? 17 * 60 + 30
      : 16 * 60 + (spec.idx * 7) % 90;
    const inTime = at(spec.day, Math.floor(inTotal / 60), inTotal % 60);
    const outTime = missOut ? null : at(spec.day, Math.floor(outTotal / 60), outTotal % 60);
    const key = did('attendance', spec.key, spec.day);
    const record = await prisma.attendanceRecord.upsert({
      where: { idempotency_key: key },
      update: {
        check_in_time: inTime,
        check_out_time: outTime,
        status: AttendanceStatusEnum.PRESENT,
        regular_hours: missOut ? 0 : 8,
        overtime_minutes: overtime ? (spec.idx === 3 ? 90 : 120) : 0,
      },
      create: {
        user_id: user.id,
        project_id: project.id,
        date: dateOnly(spec.day),
        check_in_time: inTime,
        check_out_time: outTime,
        status: AttendanceStatusEnum.PRESENT,
        check_in_latitude: project.latitude,
        check_in_longitude: project.longitude,
        check_in_distance_m: 25.5,
        is_within_geofence: true,
        check_out_latitude: project.latitude,
        check_out_longitude: project.longitude,
        regular_hours: missOut ? 0 : 8,
        overtime_minutes: overtime ? (spec.idx === 3 ? 90 : 120) : 0,
        idempotency_key: key,
        notes: overtime ? 'Ore suplimentare — montaj structură' : undefined,
      },
    });
    attendanceIds.push(record.id);

    if (!correctionMade && attendanceSpecs.indexOf(spec) === 2) {
      correctionMade = true;
      await upsertById(prisma.attendanceCorrection, did('attcorr', spec.key, spec.day), {
        attendance_id: record.id,
        corrected_by: U('siteManager').id,
        reason: 'Corecție pontaj — oră check-out greșită la sincronizare offline',
        before_state: { check_out_time: '16:00', regular_hours: 8 },
        after_state: { check_out_time: '16:30', regular_hours: 8 },
      });
    }
  }

  console.log('[demo 5/12] daily reports');

  // ---------------------------------------------------------------------------
  // 9. Daily reports (8) with children + approvals + revision
  // ---------------------------------------------------------------------------
  const allTasks = [...tasksByProject.arad, ...tasksByProject.timisoara];
  const materials: Record<string, any> = {};
  // materials are created in the supply step; create them here so reports can link.
  for (const m of MATERIALS) {
    materials[m.code] = await prisma.material.upsert({
      where: { code: m.code },
      update: {
        name: m.name,
        unit: m.unit,
        category: m.category,
        min_stock_threshold: m.threshold,
        unit_cost_estimate: m.cost,
        is_active: true,
      },
      create: {
        code: m.code,
        name: m.name,
        unit: m.unit,
        category: m.category,
        min_stock_threshold: m.threshold,
        unit_cost_estimate: m.cost,
      },
    });
  }

  const reportDefs = [
    { i: 0, project: arad, team: 'arad-main', leader: 'leaderIon', status: 'SUBMITTED', day: 1, reviewer: null as string | null },
    { i: 1, project: arad, team: 'arad-elec', leader: 'leaderMaria', status: 'SUBMITTED', day: 1, reviewer: null },
    { i: 2, project: arad, team: 'arad-main', leader: 'leaderIon', status: 'SUBMITTED', day: 2, reviewer: null },
    { i: 3, project: arad, team: 'arad-main', leader: 'leaderIon', status: 'APPROVED', day: 3, reviewer: 'pm' },
    { i: 4, project: arad, team: 'arad-elec', leader: 'leaderMaria', status: 'APPROVED', day: 4, reviewer: 'siteManager' },
    { i: 5, project: arad, team: 'arad-main', leader: 'leaderIon', status: 'APPROVED', day: 5, reviewer: 'pm' },
    { i: 6, project: timisoara, team: 'tm-main', leader: 'leaderAndrei', status: 'APPROVED', day: 3, reviewer: 'manager' },
    { i: 7, project: timisoara, team: 'tm-main', leader: 'leaderAndrei', status: 'REJECTED', day: 2, reviewer: 'pm' },
  ];
  const weather = [
    'Senin, 22°C, vânt slab',
    'Înnorat, 18°C, vânt moderat',
    'Ploaie dimineața, 15°C',
    'Senin, 25°C, vânt moderat',
    'Parțial noros, 20°C',
  ];
  const reportIds: string[] = [];
  for (const def of reportDefs) {
    const team = teams[def.team];
    const key = did('dailyreport', def.i);
    const report = await prisma.dailyReport.upsert({
      where: { idempotency_key: key },
      update: {
        status: def.status,
        reviewed_by: def.reviewer ? U(def.reviewer).id : null,
        reviewed_at: def.reviewer ? at(def.day, 18, 0) : null,
      },
      create: {
        project_id: def.project.id,
        team_id: team.id,
        team_leader_id: U(def.leader).id,
        report_date: dateOnly(def.day),
        start_time: '08:00',
        end_time: '17:00',
        weather_notes: pick(weather, def.i),
        blockages: def.i % 3 === 0 ? 'Lipsă cablu DC pe string 4-6' : null,
        proposed_work: 'Continuare montaj module și cablare DC.',
        general_notes: 'Lucru conform planului zilnic.',
        status: def.status,
        reviewed_by: def.reviewer ? U(def.reviewer).id : null,
        reviewed_at: def.reviewer ? at(def.day, 18, 0) : null,
        revision_number: 1,
        idempotency_key: key,
      },
    });
    reportIds.push(report.id);

    for (let w = 0; w < 3; w++) {
      const worker = U(pick([def.leader, 'workerCostin', 'workerRamona', 'workerDaniel'], w));
      await upsertById(prisma.dailyReportWorker, did('drw', def.i, w), {
        daily_report_id: report.id,
        worker_id: worker.id,
        hours_worked: w === 0 ? 8 : 7.5,
        overtime_hours: w === 1 ? 1 : 0,
      });
    }
    const projectTasks = tasksByProject[def.project.code === 'AR-001' ? 'arad' : 'timisoara'];
    for (let t = 0; t < 3; t++) {
      await upsertById(prisma.dailyReportTask, did('drt', def.i, t), {
        daily_report_id: report.id,
        task_id: projectTasks[(def.i + t) % projectTasks.length].id,
        quantity_done: 10 + t * 2,
      });
    }
    for (let m = 0; m < 2; m++) {
      await upsertById(prisma.dailyReportMaterial, did('drm', def.i, m), {
        daily_report_id: report.id,
        material_id: materials[m === 0 ? 'MAT-DC6' : 'MAT-MOD500'].id,
        quantity_used: 50 + m * 25,
      });
    }
    for (let o = 0; o < 2; o++) {
      await upsertById(prisma.dailyReportOhsItem, did('drohs', def.i, o), {
        daily_report_id: report.id,
        risk_type: o === 0 ? OhsRiskType.ppe : OhsRiskType.electrical,
        notes: o === 0 ? 'Cască și ham obligatoriu pe acoperiș' : 'Lucru sub tensiune interzis fără verificare',
      });
    }
    if (def.reviewer) {
      await upsertById(prisma.dailyReportApproval, did('drappr', def.i), {
        daily_report_id: report.id,
        reviewer_id: U(def.reviewer).id,
        action: def.status,
        comment: def.status === 'REJECTED' ? 'Materiale neconforme; retrimite cu poze.' : 'OK',
      });
    }
    await prisma.dailyReportRevision.upsert({
      where: { daily_report_id_revision_number: { daily_report_id: report.id, revision_number: 1 } },
      update: {},
      create: {
        daily_report_id: report.id,
        revision_number: 1,
        snapshot: { status: def.status, report_date: dateOnly(def.day).toISOString() },
        submitted_by_id: U(def.leader).id,
      },
    });
  }

  console.log('[demo 6/12] issues + inspections + NCR');

  // ---------------------------------------------------------------------------
  // 10. Issues + inspections + measurements + NCRs
  // ---------------------------------------------------------------------------
  const issueIds: string[] = [];
  const reporterPool = ['leaderIon', 'leaderMaria', 'leaderAndrei', 'foreman', 'siteManager', 'qa'];
  for (let i = 0; i < ISSUE_TITLES.length; i++) {
    const project = i % 3 === 0 ? timisoara : arad;
    const issue = await upsertById(prisma.issue, did('issue', i), {
      project_id: project.id,
      title: ISSUE_TITLES[i],
      description: `${ISSUE_TITLES[i]}. Semnalat pe șantier.`,
      severity: ISSUE_SEVERITIES[i],
      status: ISSUE_STATUSES[i],
      reported_by: U(reporterPool[i % reporterPool.length]).id,
      created_at: at(6 - (i % 6), 9, i),
    });
    issueIds.push(issue.id);
  }

  const templateDc = await prisma.inspectionTemplate.upsert({
    where: { code: 'TPL-DC' },
    update: {},
    create: {
      name: 'Verificare instalație DC',
      code: 'TPL-DC',
      checklist: {
        items: ['Tensiune string', 'Rezistență izolație', 'Cuplu conexiuni', 'Marcaj cabluri'],
      },
    },
  });
  const templateStruct = await prisma.inspectionTemplate.upsert({
    where: { code: 'TPL-STRUCT' },
    update: {},
    create: {
      name: 'Verificare structură montaj',
      code: 'TPL-STRUCT',
      checklist: { items: ['Aliniere șine', 'Cuplu șuruburi', 'Împământare'] },
    },
  });

  const inspectionDefs = [
    { i: 0, project: arad, status: 'PASSED', tpl: templateDc },
    { i: 1, project: arad, status: 'PASSED', tpl: templateStruct },
    { i: 2, project: arad, status: 'FAILED', tpl: templateDc },
    { i: 3, project: timisoara, status: 'PASSED', tpl: templateDc },
    { i: 4, project: timisoara, status: 'FAILED', tpl: templateStruct },
    { i: 5, project: arad, status: 'IN_PROGRESS', tpl: templateDc },
  ];
  const failedInspectionIds: string[] = [];
  for (const def of inspectionDefs) {
    const failed = def.status === 'FAILED';
    const inspection = await upsertById(prisma.inspection, did('inspection', def.i), {
      project_id: def.project.id,
      template_id: def.tpl.id,
      inspector_name: 'Cristina Dobre',
      status: def.status,
      inspected_at: at(def.i + 1, 11, 0),
    });
    if (failed) failedInspectionIds.push(inspection.id);

    const measurements = [
      { parameter: 'Tensiune string', value: failed ? 742.5 : 780.2, unit: 'V', passed: !failed },
      { parameter: 'Rezistență izolație', value: failed ? 0.6 : 12.4, unit: 'MΩ', passed: !failed },
      { parameter: 'Cuplu conexiuni', value: failed ? 12.5 : 22.0, unit: 'Nm', passed: !failed },
    ];
    for (let mi = 0; mi < measurements.length; mi++) {
      const m = measurements[mi];
      await upsertById(prisma.measurement, did('measurement', def.i, mi), {
        inspection_id: inspection.id,
        parameter: m.parameter,
        value: m.value,
        unit: m.unit,
        passed: m.passed,
      });
    }
  }

  for (let n = 0; n < 2; n++) {
    await prisma.nCR.upsert({
      where: { ncr_number: `NCR-${n === 0 ? 'AR' : 'TM'}-001` },
      update: { status: NCRStatusEnum.OPEN },
      create: {
        inspection_id: failedInspectionIds[n] ?? null,
        issue_id: issueIds[n === 0 ? 2 : 11] ?? null,
        ncr_number: `NCR-${n === 0 ? 'AR' : 'TM'}-001`,
        description:
          n === 0
            ? 'Rezistență de izolație sub prag pe string 4 — cablu deteriorat la tragere.'
            : 'Structură nealiniată în zona C — cuplu șuruburi sub specificație.',
        status: NCRStatusEnum.OPEN,
      },
    });
  }

  console.log('[demo 7/12] supply chain');

  // ---------------------------------------------------------------------------
  // 11. Warehouses + stock movements + balances + suppliers + POs + avize
  // ---------------------------------------------------------------------------
  const whCentral = await prisma.warehouse.upsert({
    where: { code: 'WH-CENTRAL' },
    update: { name: 'Depozit Central', address: 'Str. Depozitelor 1, Arad' },
    create: { organization_id: orgId, name: 'Depozit Central', code: 'WH-CENTRAL', address: 'Str. Depozitelor 1, Arad' },
  });
  const whArad = await prisma.warehouse.upsert({
    where: { code: 'WH-ARAD' },
    update: { name: 'Depozit Șantier Arad', address: 'Calea Aradului 100, Arad' },
    create: { organization_id: orgId, name: 'Depozit Șantier Arad', code: 'WH-ARAD', address: 'Calea Aradului 100, Arad' },
  });
  const whByCode: Record<string, any> = { 'WH-CENTRAL': whCentral, 'WH-ARAD': whArad };

  const movements: MovementSpec[] = [];
  for (const m of MATERIALS) {
    movements.push({ material: m.code, type: StockMovementTypeEnum.RECEIPT, qty: OPENINGS[m.code], to: 'WH-CENTRAL', project: 'AR-001', note: 'Stoc inițial' });
  }
  movements.push({ material: 'MAT-SURUBM8', type: StockMovementTypeEnum.RECEIPT, qty: 2000, to: 'WH-CENTRAL', project: 'AR-001', note: 'Reaprovizionare' });
  movements.push({ material: 'MAT-MC4', type: StockMovementTypeEnum.RECEIPT, qty: 500, to: 'WH-CENTRAL', project: 'AR-001', note: 'Reaprovizionare' });
  for (const [code, qty] of CONSUMPTIONS) {
    movements.push({ material: code, type: StockMovementTypeEnum.CONSUMPTION, qty, from: 'WH-CENTRAL', project: 'AR-001', note: 'Consum șantier' });
  }
  for (const [code, qty] of TRANSFERS) {
    movements.push({ material: code, type: StockMovementTypeEnum.TRANSFER, qty, from: 'WH-CENTRAL', to: 'WH-ARAD', project: 'AR-001', note: 'Transfer pe șantier' });
  }

  const balances = new Map<string, { material: string; warehouse: string; qty: number }>();
  const bump = (material: string, warehouse: string, delta: number) => {
    const k = `${material}|${warehouse}`;
    const cur = balances.get(k) ?? { material, warehouse, qty: 0 };
    cur.qty += delta;
    balances.set(k, cur);
  };
  for (let mi = 0; mi < movements.length; mi++) {
    const mv = movements[mi];
    const mat = materials[mv.material];
    await prisma.stockMovement.upsert({
      where: { idempotency_key: did('mov', mi) },
      update: {
        movement_type: mv.type,
        quantity: mv.qty,
        warehouse_id: whByCode[mv.to ?? mv.from ?? 'WH-CENTRAL'].id,
        notes: mv.note,
      },
      create: {
        material_id: mat.id,
        project_id: arad.id,
        warehouse_id: whByCode[mv.to ?? mv.from ?? 'WH-CENTRAL'].id,
        movement_type: mv.type,
        quantity: mv.qty,
        reference_type: 'DEMO',
        notes: mv.note,
        created_at: at(10 - (mi % 10), 10, mi),
        idempotency_key: did('mov', mi),
      },
    });
    if (mv.type === StockMovementTypeEnum.RECEIPT) bump(mv.material, mv.to!, mv.qty);
    if (mv.type === StockMovementTypeEnum.CONSUMPTION) bump(mv.material, mv.from!, -mv.qty);
    if (mv.type === StockMovementTypeEnum.TRANSFER) {
      bump(mv.material, mv.from!, -mv.qty);
      bump(mv.material, mv.to!, mv.qty);
    }
  }
  for (const [k, b] of balances) {
    await upsertById(prisma.stockBalance, did('balance', k), {
      material_id: materials[b.material].id,
      warehouse_id: whByCode[b.warehouse].id,
      current_quantity: b.qty,
      reserved_quantity: 0,
    });
  }

  const suppliers = [
    { cui: 'DEMO-SUP-001', name: 'Solar Components SRL', address: 'Bd. Industrial 5, Cluj', contact_person: 'Vlad Ionescu', contact_email: 'sales@solarcomponents.demo', contact_phone: '+40 264 100 100' },
    { cui: 'DEMO-SUP-002', name: 'Electric Import SRL', address: 'Str. Electricei 8, București', contact_person: 'Ioana Dinu', contact_email: 'office@electricimport.demo', contact_phone: '+40 21 200 200' },
    { cui: 'DEMO-SUP-003', name: 'Profile Metal SRL', address: 'Calea Metalurgiei 3, Reșița', contact_person: 'Petru Marin', contact_email: 'contact@profilemetal.demo', contact_phone: '+40 255 300 300' },
  ];
  const supplierByCui: Record<string, any> = {};
  for (const s of suppliers) {
    supplierByCui[s.cui] = await prisma.supplier.upsert({
      where: { cui: s.cui },
      update: { name: s.name, address: s.address, contact_person: s.contact_person, contact_email: s.contact_email, contact_phone: s.contact_phone },
      create: { organization_id: orgId, ...s },
    });
  }

  const poDefs = [
    { number: 'PO-DEMO-001', supplier: 'DEMO-SUP-001', status: 'RECEIVED', items: [['MAT-MOD500', 200, 760], ['MAT-MC4', 400, 6.2]] },
    { number: 'PO-DEMO-002', supplier: 'DEMO-SUP-002', status: 'APPROVED', items: [['MAT-INV25', 10, 9100], ['MAT-DC6', 1500, 8.2]] },
    { number: 'PO-DEMO-003', supplier: 'DEMO-SUP-003', status: 'DRAFT', items: [['MAT-PROF4M', 800, 92]] },
  ];
  for (const po of poDefs) {
    const total = po.items.reduce((sum, [, qty, price]) => sum + (qty as number) * (price as number), 0);
    const purchaseOrder = await prisma.purchaseOrder.upsert({
      where: { order_number: po.number },
      update: { status: po.status, total_amount: total },
      create: {
        supplier_id: supplierByCui[po.supplier].id,
        order_number: po.number,
        total_amount: total,
        currency: 'RON',
        status: po.status,
        order_date: at(20, 9, 0),
      },
    });
    for (let i = 0; i < po.items.length; i++) {
      const [code, qty, price] = po.items[i];
      await upsertById(prisma.purchaseOrderItem, did('poitem', po.number, i), {
        purchase_order_id: purchaseOrder.id,
        material_id: materials[code].id,
        quantity: qty,
        unit_price: price,
      });
    }
  }

  const avizDefs = [
    { project: arad, number: 'AVZ-AR-001', supplier: 'DEMO-SUP-001', status: AvizStatusEnum.DELIVERED, day: 4 },
    { project: arad, number: 'AVZ-AR-002', supplier: 'DEMO-SUP-002', status: AvizStatusEnum.DELIVERED, day: 3 },
    { project: arad, number: 'AVZ-AR-003', supplier: 'DEMO-SUP-003', status: AvizStatusEnum.PENDING, day: 1 },
    { project: timisoara, number: 'AVZ-TM-001', supplier: 'DEMO-SUP-001', status: AvizStatusEnum.DELIVERED, day: 5 },
    { project: timisoara, number: 'AVZ-TM-002', supplier: 'DEMO-SUP-002', status: AvizStatusEnum.PENDING, day: 1 },
  ];
  for (const a of avizDefs) {
    const aviz = await prisma.aviz.upsert({
      where: { project_id_aviz_number: { project_id: a.project.id, aviz_number: a.number } },
      update: { status: a.status },
      create: {
        project_id: a.project.id,
        supplier_id: supplierByCui[a.supplier].id,
        aviz_number: a.number,
        delivery_date: dateOnly(a.day),
        status: a.status,
        driver_name: 'Ion Șoferu',
        vehicle_plate: 'AR-12-DEMO',
        notes: 'Livrare materiale conform comandă.',
      },
    });
    await upsertById(prisma.avizItem, did('avizitem', a.number, 0), {
      aviz_id: aviz.id,
      material_id: materials['MAT-DC6'].id,
      quantity: 200,
    });
  }

  console.log('[demo 8/12] expenses');

  // ---------------------------------------------------------------------------
  // 12. Expenses (15) + lines + approvals
  // ---------------------------------------------------------------------------
  const expenseCategories = [
    ExpenseCategoryEnum.MATERIALS_EMERGENCY,
    ExpenseCategoryEnum.TRANSPORT_LOGISTICS,
    ExpenseCategoryEnum.TOOLS_CONSUMABLES,
    ExpenseCategoryEnum.SERVICES_SUBCONTRACTORS,
    ExpenseCategoryEnum.FUEL,
    ExpenseCategoryEnum.SUBSISTENCE_ACCOMMODATION,
  ];
  const expenseStatuses: ExpenseStatusEnum[] = [
    ExpenseStatusEnum.SUBMITTED,
    ExpenseStatusEnum.SUBMITTED,
    ExpenseStatusEnum.SUBMITTED,
    ExpenseStatusEnum.SUBMITTED,
    ExpenseStatusEnum.SUBMITTED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.APPROVED,
    ExpenseStatusEnum.REJECTED,
    ExpenseStatusEnum.REJECTED,
  ];
  const expenseSubmitters = ['leaderIon', 'leaderMaria', 'foreman', 'siteManager', 'procurement'];
  for (let i = 0; i < expenseStatuses.length; i++) {
    const amount = 50 + ((i * 347) % 4950);
    const key = did('expense', i);
    const expense = await prisma.expense.upsert({
      where: { idempotency_key: key },
      update: { status: expenseStatuses[i], amount },
      create: {
        project_id: i % 3 === 0 ? timisoara.id : arad.id,
        submitted_by_id: U(expenseSubmitters[i % expenseSubmitters.length]).id,
        category: expenseCategories[i % expenseCategories.length],
        payment_method: PaymentMethodEnum.COMPANY_CARD,
        amount,
        vat_amount: Math.round(amount * 0.19),
        currency: 'RON',
        expense_date: dateOnly(i % 6),
        merchant_name: 'Furnizor Demo ' + (i + 1),
        description: 'Cheltuială demo #' + (i + 1),
        status: expenseStatuses[i],
        idempotency_key: key,
      },
    });
    await upsertById(prisma.expenseLine, did('expenseline', i, 0), {
      expense_id: expense.id,
      description: 'Linie ' + (i + 1),
      amount,
      vat_rate: 19,
    });
    if (expenseStatuses[i] === ExpenseStatusEnum.APPROVED || expenseStatuses[i] === ExpenseStatusEnum.REJECTED) {
      await upsertById(prisma.expenseApproval, did('expenseappr', i), {
        expense_id: expense.id,
        approver_id: U('finance').id,
        status: expenseStatuses[i] === ExpenseStatusEnum.APPROVED ? 'APPROVED' : 'REJECTED',
        notes: expenseStatuses[i] === ExpenseStatusEnum.APPROVED ? 'Aprobat' : 'Respins — lipsă document justificativ',
      });
    }
  }

  console.log('[demo 9/12] documents + attachments');

  // ---------------------------------------------------------------------------
  // 13. Documents (10) + versions + attachments (15)
  // ---------------------------------------------------------------------------
  const docDefs = [
    { i: 0, project: arad, type: DocumentTypeEnum.CONTRACT, title: 'Contract executie Parc Solar Arad', version: 2, days: 90 },
    { i: 1, project: arad, type: DocumentTypeEnum.PLAN_TEHNIC, title: 'Plan tehnic montaj structura', version: 3, days: 40 },
    { i: 2, project: arad, type: DocumentTypeEnum.CERTIFICAT_CONFORMITATE, title: 'Certificat conformitate module', version: 1, days: 20 },
    { i: 3, project: arad, type: DocumentTypeEnum.FACTURA, title: 'Factura furnizor componente', version: 1, days: 10 },
    { i: 4, project: arad, type: DocumentTypeEnum.PROCES_VERBAL, title: 'Proces verbal receptie lucrari', version: 1, days: 3 },
    { i: 5, project: arad, type: DocumentTypeEnum.CONTRACT, title: 'Autorizatie construire (expirata)', version: 1, days: 400 },
    { i: 6, project: timisoara, type: DocumentTypeEnum.CONTRACT, title: 'Contract executie Parc Solar Timisoara', version: 1, days: 280 },
    { i: 7, project: timisoara, type: DocumentTypeEnum.PLAN_TEHNIC, title: 'Plan tehnic final', version: 2, days: 100 },
    { i: 8, project: timisoara, type: DocumentTypeEnum.RAPORT_TESTARE, title: 'Raport testare izolatie', version: 1, days: 45 },
    { i: 9, project: timisoara, type: DocumentTypeEnum.PROCES_VERBAL, title: 'Proces verbal predare-primire', version: 1, days: 35 },
  ];
  const documentIds: string[] = [];
  for (const d of docDefs) {
    const doc = await upsertById(prisma.document, did('document', d.i), {
      project_id: d.project.id,
      document_type: d.type,
      title: d.title,
      code: `DOC-${d.i + 1}`,
      storage_path: `demo/documents/doc-${d.i + 1}.pdf`,
      current_version: d.version,
      created_at: at(d.days, 9, 0),
    });
    documentIds.push(doc.id);
    for (let v = 1; v <= d.version; v++) {
      await prisma.documentVersion.upsert({
        where: { document_id_version: { document_id: doc.id, version: v } },
        update: {},
        create: {
          document_id: doc.id,
          version: v,
          storage_path: `demo/documents/doc-${d.i + 1}-v${v}.pdf`,
          file_size: 120000 * v,
          checksum: `demo-checksum-${d.i + 1}-${v}`,
          uploaded_by: U('pm').id,
          created_at: at(d.days - v, 9, 0),
        },
      });
    }
  }

  const attachmentTargets = [
    ...tasksByProject.arad.slice(0, 4).map((t) => ({ target_type: 'task', target_id: t.id, name: `site-arad-task-${t.code}.jpg` })),
    ...tasksByProject.timisoara.slice(0, 3).map((t) => ({ target_type: 'task', target_id: t.id, name: `site-tm-task-${t.code}.jpg` })),
    ...reportIds.slice(0, 3).map((id, i) => ({ target_type: 'daily_report', target_id: id, name: `raport-zilnic-${i + 1}.jpg` })),
    ...issueIds.slice(0, 2).map((id, i) => ({ target_type: 'issue', target_id: id, name: `problema-${i + 1}.jpg` })),
    { target_type: 'project', target_id: arad.id, name: 'site-zone-a-01.jpg' },
    { target_type: 'project', target_id: arad.id, name: 'site-zone-b-02.jpg' },
    { target_type: 'project', target_id: timisoara.id, name: 'site-tm-01.jpg' },
  ];
  for (let i = 0; i < attachmentTargets.length; i++) {
    const a = attachmentTargets[i];
    await upsertById(prisma.attachment, did('attachment', i), {
      target_type: a.target_type,
      target_id: a.target_id,
      file_name: a.name,
      storage_url: `demo/attachments/${a.name}`,
      mime_type: a.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    });
  }

  console.log('[demo 10/12] change orders + budgets + costs');

  // ---------------------------------------------------------------------------
  // 14. Change orders (2) + budgets + cost entries
  // ---------------------------------------------------------------------------
  const changeOrderDefs = [
    { number: 'CO-AR-001', title: 'Suplimentare 40 module zona C', description: 'Clientul solicită extinderea zonei C cu 40 module.', cost: 62000, schedule: 5, status: ChangeOrderStatusEnum.SUBMITTED },
    { number: 'CO-AR-002', title: 'Înlocuire cablu DC deteriorat', description: 'Înlocuire 300 m cablu DC deteriorat la tragere.', cost: 8400, schedule: 2, status: ChangeOrderStatusEnum.APPROVED },
  ];
  for (const co of changeOrderDefs) {
    await prisma.changeOrder.upsert({
      where: { order_number: co.number },
      update: { status: co.status, cost_impact: co.cost },
      create: {
        project_id: arad.id,
        order_number: co.number,
        title: co.title,
        description: co.description,
        cost_impact: co.cost,
        schedule_impact: co.schedule,
        status: co.status,
      },
    });
  }

  const budgetDefs = [
    { project: arad, limit: 12500000, lines: [['Materiale', 6000000], ['Manoperă', 3500000], ['Utilaje', 1500000], ['Altele', 1500000]] },
    { project: timisoara, limit: 7800000, lines: [['Materiale', 4000000], ['Manoperă', 2200000], ['Utilaje', 900000], ['Altele', 700000]] },
  ];
  const costCategories = ['Materiale', 'Manoperă', 'Utilaje', 'Transport', 'Servicii'];
  for (const b of budgetDefs) {
    const budget = await prisma.budget.upsert({
      where: { project_id_version: { project_id: b.project.id, version: 1 } },
      update: { total_limit: b.limit },
      create: { project_id: b.project.id, version: 1, total_limit: b.limit },
    });
    for (let li = 0; li < b.lines.length; li++) {
      const [category, allocated] = b.lines[li];
      await upsertById(prisma.budgetLine, did('budgetline', b.project.code, li), {
        budget_id: budget.id,
        category,
        allocated,
      });
    }
    for (let ci = 0; ci < 6; ci++) {
      await upsertById(prisma.costEntry, did('costentry', b.project.code, ci), {
        project_id: b.project.id,
        category: costCategories[ci % costCategories.length],
        amount: 25000 + ci * 17000,
        entry_date: dateOnly(ci * 3),
      });
    }
  }

  console.log('[demo 11/12] notifications + audit log');

  // ---------------------------------------------------------------------------
  // 15. Notifications (12 for dev, 5 for each other role)
  // ---------------------------------------------------------------------------
  const notifPriorities = [
    NotificationPriorityEnum.URGENT,
    NotificationPriorityEnum.HIGH,
    NotificationPriorityEnum.NORMAL,
    NotificationPriorityEnum.LOW,
  ];
  const notifTypes = [
    ['Task restant', 'Overdue task', 'Taskul "Cablare DC" este restant.', 'Task "DC cabling" is overdue.'],
    ['Raport de aprobat', 'Report to approve', 'Un raport zilnic așteaptă aprobarea ta.', 'A daily report is waiting for your approval.'],
    ['Problemă critică', 'Critical issue', 'O problemă critică a fost raportată.', 'A critical issue was reported.'],
    ['Livrare materiale', 'Material delivery', 'Un aviz de livrare este în așteptare.', 'A delivery note is pending.'],
    ['Cheltuială de aprobat', 'Expense to approve', 'O cheltuială așteaptă aprobarea.', 'An expense is waiting for approval.'],
  ];
  const notifRecipients = ['admin', 'owner', 'manager', 'pm', 'siteManager', 'foreman', 'qa', 'finance', 'procurement', 'viewer'];
  for (const rec of notifRecipients) {
    const count = rec === 'admin' ? 12 : 5;
    for (let i = 0; i < count; i++) {
      const t = notifTypes[i % notifTypes.length];
      await upsertById(prisma.notification, did('notif', rec, i), {
        user_id: U(rec).id,
        title_ro: t[0],
        title_en: t[1],
        message_ro: t[2],
        message_en: t[3],
        priority: notifPriorities[i % notifPriorities.length],
        action_url: '/tasks',
        metadata: { demo: true, index: i },
        is_read: i % 3 === 0,
        read_at: i % 3 === 0 ? at(1, 9, 0) : null,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 16. Audit log (30 entries — feeds the Activity page + Control Tower)
  // ---------------------------------------------------------------------------
  const flatTasks = [...tasksByProject.arad, ...tasksByProject.timisoara];
  const auditDefs: Array<{ action: string; entity: string; entityId: string; actor: string; before?: any; after?: any }> = [];
  const auditActors = ['leaderIon', 'leaderMaria', 'leaderAndrei', 'siteManager', 'pm', 'qa'];
  for (let i = 0; i < 30; i++) {
    const actor = auditActors[i % auditActors.length];
    const mod = i % 6;
    if (mod === 0) {
      const t = flatTasks[i % flatTasks.length];
      auditDefs.push({ action: 'TASK_CREATED', entity: 'Task', entityId: t.id, actor, after: { title: t.title, code: t.code, status: 'PLANNED', projectId: t.project_id } });
    } else if (mod === 1) {
      const t = flatTasks[i % flatTasks.length];
      auditDefs.push({ action: 'TASK_STATUS_CHANGED', entity: 'Task', entityId: t.id, actor, before: { status: 'PLANNED' }, after: { status: 'IN_PROGRESS', projectId: t.project_id } });
    } else if (mod === 2) {
      const r = reportIds[i % reportIds.length];
      auditDefs.push({ action: 'DAILY_REPORT_APPROVED', entity: 'DailyReport', entityId: r, actor, after: { status: 'APPROVED' } });
    } else if (mod === 3) {
      const iss = issueIds[i % issueIds.length];
      auditDefs.push({ action: 'ISSUE_REPORTED', entity: 'Issue', entityId: iss, actor, after: { status: 'OPEN' } });
    } else if (mod === 4) {
      const att = attendanceIds[i % attendanceIds.length];
      auditDefs.push({ action: 'ATTENDANCE_CHECK_IN', entity: 'AttendanceRecord', entityId: att, actor, after: { status: 'PRESENT' } });
    } else {
      const t = flatTasks[i % flatTasks.length];
      auditDefs.push({ action: 'TASK_BLOCKED', entity: 'Task', entityId: t.id, actor, after: { reason: 'Lipsă cablu DC', projectId: t.project_id } });
    }
  }
  auditDefs.push(
    { action: 'LOGIN', entity: 'User', entityId: U('admin').id, actor: 'admin' },
    { action: 'LOGOUT', entity: 'User', entityId: U('admin').id, actor: 'admin' },
    { action: 'ROLE_CHANGED', entity: 'User', entityId: U('viewer').id, actor: 'admin', before: { role: 'WORKER' }, after: { role: 'VIEWER' } },
  );
  for (let i = 0; i < auditDefs.length; i++) {
    const a = auditDefs[i];
    await upsertById(prisma.auditLog, did('audit', i), {
      organization_id: orgId,
      actor_id: U(a.actor).id,
      action: a.action,
      entity: a.entity,
      entity_id: a.entityId,
      before_state: a.before ?? null,
      after_state: a.after ?? null,
      metadata: { demo: true },
      created_at: hoursAgo(i * 0.8),
    });
  }

  console.log('[demo 12/12] solar designs');

  // ---------------------------------------------------------------------------
  // 17. Solar designs (1 per project) with roof sections + modules
  // ---------------------------------------------------------------------------
  const spec = await prisma.solarModuleSpec.upsert({
    where: { manufacturer_model: { manufacturer: 'Hiieko', model: 'HE-550' } },
    update: {},
    create: {
      manufacturer: 'Hiieko',
      model: 'HE-550',
      power_wp: 550,
      length_mm: 2278,
      width_mm: 1134,
      thickness_mm: 35,
      weight_kg: 27.5,
      voc: 49.9,
      isc: 14.0,
      vmp: 41.8,
      imp: 13.16,
      technology: 'TOPCon',
      module_type: 'Monocrystalline',
    },
  });

  const designDefs = [
    { project: arad, name: 'Proiectare Parc Solar Arad', sections: ['Sector Est', 'Sector Vest'] },
    { project: timisoara, name: 'Proiectare Parc Solar Timisoara', sections: ['Sector Nord', 'Sector Sud'] },
  ];
  for (const dd of designDefs) {
    const design = await prisma.solarDesign.upsert({
      where: { project_id_name: { project_id: dd.project.id, name: dd.name } },
      update: { status: SolarDesignStatusEnum.APPROVED },
      create: {
        project_id: dd.project.id,
        name: dd.name,
        description: 'Proiectare demo cu secțiuni și module.',
        status: SolarDesignStatusEnum.APPROVED,
        created_by: U('pm').id,
      },
    });
    await prisma.solarLayoutSettings.upsert({
      where: { design_id: design.id },
      update: { module_spec_id: spec.id },
      create: {
        design_id: design.id,
        module_spec_id: spec.id,
        orientation: SolarModuleOrientationEnum.PORTRAIT,
        edge_margin_mm: 300,
        row_spacing_mm: 20,
        column_spacing_mm: 20,
      },
    });
    for (let s = 0; s < dd.sections.length; s++) {
      const section = await upsertById(prisma.solarRoofSection, did('roofsection', dd.project.code, s), {
        design_id: design.id,
        name: dd.sections[s],
        roof_type: SolarRoofTypeEnum.FLAT,
        surface_type: SolarSurfaceTypeEnum.GROUND,
        slope_deg: 5,
        azimuth_deg: 180,
        roof_material: 'Sol',
        polygon: { points: [[0, 0], [20, 0], [20, 10], [0, 10]] },
        origin: { x: 0, y: 0, z: 0 },
      });
      for (let m = 0; m < 6; m++) {
        await upsertById(prisma.solarModulePlacement, did('placement', dd.project.code, s, m), {
          design_id: design.id,
          roof_section_id: section.id,
          module_spec_id: spec.id,
          row: Math.floor(m / 3),
          column: m % 3,
          local_x: (m % 3) * 1150,
          local_y: Math.floor(m / 3) * 2300,
          local_z: 0,
          rotation_deg: 0,
          width_mm: 1134,
          height_mm: 2278,
        });
      }
    }
    const version = await prisma.solarDesignVersion.upsert({
      where: { design_id_version: { design_id: design.id, version: 1 } },
      update: {},
      create: {
        design_id: design.id,
        version: 1,
        label: 'v1',
        status: SolarDesignStatusEnum.APPROVED,
        snapshot: { sections: dd.sections, modulesPerSection: 6 },
        created_by: U('pm').id,
      },
    });
    await prisma.solarDesign.update({
      where: { id: design.id },
      data: { current_version_id: version.id },
    });
  }

  console.log();
  console.log('========================================');
  console.log('DEMO ENVIRONMENT OK');
  console.log('========================================');
  console.log(`Projects:     ${arad.code}, ${timisoara.code}`);
  console.log(`Tasks:        ${flatTasks.length}`);
  console.log(`Daily plans:  28`);
  console.log(`Attendance:   ${attendanceIds.length}`);
  console.log(`Reports:      ${reportIds.length}`);
  console.log(`Issues:       ${issueIds.length}`);
  console.log(`Documents:    ${documentIds.length}`);
  console.log(`Attachments:  ${attachmentTargets.length}`);
  console.log();
}

// Re-export a couple of ids so callers can log them if needed.
export { EMAILS, addMinutes };
