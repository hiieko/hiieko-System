import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Canonical demo accounts for the seeded development dataset. The frontend owns the
 * passwords; the backend only reports which of these accounts actually exist in the
 * database AND have data behind them. `role`/`label` are the display pairs the client
 * expects (`GET /api/demo/accounts`).
 */
const DEMO_ACCOUNTS: ReadonlyArray<{ email: string; role: string; label: string }> = [
  { email: 'dev@hiieko.local', role: 'ADMIN', label: 'Admin' },
  { email: 'owner@hiieko.local', role: 'OWNER', label: 'Owner' },
  { email: 'manager@hiieko.local', role: 'MANAGER', label: 'Manager' },
  { email: 'pm@hiieko.local', role: 'PM', label: 'Project Manager' },
  { email: 'site.manager@hiieko.local', role: 'SITE_MANAGER', label: 'Site Manager' },
  { email: 'foreman@hiieko.local', role: 'FOREMAN', label: 'Foreman' },
  { email: 'ion.munteanu@hiieko.local', role: 'TEAM_LEADER', label: 'Team Leader' },
  { email: 'costin.dumitrescu@hiieko.local', role: 'WORKER', label: 'Worker' },
  { email: 'qa@hiieko.local', role: 'QA_QC', label: 'QA/QC' },
  { email: 'finance@hiieko.local', role: 'FINANCE', label: 'Finance' },
  { email: 'procurement@hiieko.local', role: 'PROCUREMENT', label: 'Procurement' },
  { email: 'viewer@hiieko.local', role: 'VIEWER', label: 'Viewer' },
];

export interface DemoAccount {
  role: string;
  label: string;
  email: string;
  hasData: boolean;
}

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccounts(): Promise<DemoAccount[]> {
    // Inert in production unless explicitly enabled: the endpoint exists but returns
    // nothing so a real deployment never advertises demo logins.
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      return [];
    }

    const emails = DEMO_ACCOUNTS.map((account) => account.email.toLowerCase());

    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: {
        id: true,
        email: true,
        _count: {
          select: {
            project_members: true,
            assigned_tasks: true,
            daily_reports: true,
            time_logs: true,
          },
        },
      },
    });

    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((user) => user.id);

    // These two tables reference the user by a plain scalar (no Prisma relation), so
    // they are resolved separately: issues by reporter, reports by participating worker.
    const [issueReporters, reportWorkers] = await Promise.all([
      this.prisma.issue.findMany({
        where: { reported_by: { in: userIds } },
        select: { reported_by: true },
        distinct: ['reported_by'],
      }),
      this.prisma.dailyReportWorker.findMany({
        where: { worker_id: { in: userIds } },
        select: { worker_id: true },
        distinct: ['worker_id'],
      }),
    ]);

    const usersWithIssues = new Set(issueReporters.map((row) => row.reported_by));
    const usersInReports = new Set(reportWorkers.map((row) => row.worker_id));

    const usersByEmail = new Map(
      users.map((user) => [user.email.toLowerCase(), user]),
    );

    const accounts: DemoAccount[] = [];
    for (const account of DEMO_ACCOUNTS) {
      const user = usersByEmail.get(account.email.toLowerCase());
      if (!user) {
        continue;
      }

      const hasData =
        user._count.project_members > 0 ||
        user._count.assigned_tasks > 0 ||
        user._count.daily_reports > 0 ||
        user._count.time_logs > 0 ||
        usersWithIssues.has(user.id) ||
        usersInReports.has(user.id);

      if (!hasData) {
        continue;
      }

      accounts.push({
        role: account.role,
        label: account.label,
        email: user.email,
        hasData: true,
      });
    }

    return accounts;
  }
}
