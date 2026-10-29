import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ControlTowerSurface } from './ControlTowerSurface';
import type { DeadlineItem } from '../lib/api-client';

const mockUseAuth = jest.fn();
const mockUseProject = jest.fn();
const mockGetOverview = jest.fn();
const mockGetRedFlags = jest.fn();
const mockGetActivity = jest.fn();
const mockGetAttendanceRecords = jest.fn();
const mockGetDailyPlans = jest.fn();
const mockGetIssues = jest.fn();

const authorizedProjects = [
  {
    id: 'project-1', name: 'North site', code: 'NS-01', status: 'CONSTRUCTION',
    latitude: 45.75, longitude: 21.23, target_end_date: '2026-11-15T00:00:00.000Z', is_active: true,
  },
  {
    id: 'project-2', name: 'South site', code: 'SS-02', status: 'CONSTRUCTION',
    latitude: null, longitude: null, target_end_date: null, is_active: true,
  },
];

jest.mock('../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('../contexts/ProjectContext', () => ({ useProject: () => mockUseProject() }));
jest.mock('../lib/api-client', () => ({
  apiClient: {
    getControlTowerOverview: (...args: unknown[]) => mockGetOverview(...args),
    getControlTowerRedFlags: (...args: unknown[]) => mockGetRedFlags(...args),
    getControlTowerDrillDown: jest.fn(),
  },
}));
jest.mock('../features/activity/api', () => ({
  getActivity: (...args: unknown[]) => mockGetActivity(...args),
}));
jest.mock('../features/attendance/api', () => ({
  getAllAttendanceRecords: (...args: unknown[]) => mockGetAttendanceRecords(...args),
}));
jest.mock('../features/planning/api', () => ({
  getDailyPlans: (...args: unknown[]) => mockGetDailyPlans(...args),
}));
jest.mock('../features/issues/api', () => ({
  getIssues: (...args: unknown[]) => mockGetIssues(...args),
}));
jest.mock('./ControlTowerProjectMap', () => ({
  ControlTowerProjectMap: ({
    sites,
    selectedSiteId,
    onSelectSite,
  }: {
    sites: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }>;
    selectedSiteId: string | null;
    onSelectSite: (id: string) => void;
  }) => (
    <section aria-label="Project map selection">
      {sites.map((site) => (
        <button key={site.id} type="button" aria-pressed={site.id === selectedSiteId} onClick={() => onSelectSite(site.id)}>
          {site.name} · {site.latitude ?? 'no latitude'} · {site.longitude ?? 'no longitude'}
        </button>
      ))}
    </section>
  ),
}));
jest.mock('@solar/shared', () => ({
  t: (key: string) => key,
  useLocale: () => ({ locale: 'en' }),
  canCreateProjects: () => false,
}));
jest.mock('next/link', () => {
  const ReactModule = jest.requireActual('react');
  return ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    ReactModule.createElement('a', { href, ...props }, children);
});
jest.mock('./ControlTowerDrilldownDrawer', () => ({ ControlTowerDrilldownDrawer: () => null }));
jest.mock('./PageTutorial', () => ({ PageTutorial: () => null }));
jest.mock('./ui', () => {
  const ReactModule = jest.requireActual('react');
  return {
    Card: ({ children, className = '' }: React.HTMLAttributes<HTMLDivElement> & { padding?: boolean }) =>
      ReactModule.createElement('div', { className }, children),
    Button: ({ children, onClick, disabled, icon, iconPosition, variant, size, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; iconPosition?: string; variant?: string; size?: string }) =>
      ReactModule.createElement('button', { ...props, onClick, disabled }, icon, children),
    EmptyState: ({ title, description }: { title: string; description: string }) =>
      ReactModule.createElement('div', null, ReactModule.createElement('h2', null, title), ReactModule.createElement('p', null, description)),
    ErrorState: ({ title, error, onRetry }: { title: string; error: string; onRetry: () => void }) =>
      ReactModule.createElement('div', { role: 'alert' }, title, error, ReactModule.createElement('button', { onClick: onRetry }, 'Retry')),
    Skeleton: ({ className = '' }: { className?: string }) => ReactModule.createElement('div', { className, 'data-testid': 'skeleton' }),
    Pagination: () => null,
  };
});

const overview = (projectName = 'North site') => ({
  projects: {
    activeProjects: 2,
    projectsByStage: { CONSTRUCTION: 2 },
    upcomingDeadlines: 1,
    overdueProjects: 1,
    activeProjectsList: [
      {
        id: 'project-1',
        name: projectName,
        code: 'NS-01',
        stage: 'CONSTRUCTION',
        targetEndDate: '2026-11-15T00:00:00.000Z',
        budgetTotal: 10,
        currency: 'RON',
        progressPercent: 42,
      },
      {
        id: 'project-2',
        name: 'South site',
        code: 'SS-02',
        stage: 'CONSTRUCTION',
        targetEndDate: '2026-12-01T00:00:00.000Z',
        budgetTotal: 20,
        currency: 'RON',
        progressPercent: 20,
      },
    ],
    upcomingDeadlinesList: [] as DeadlineItem[],
    overdueProjectsList: [
      {
        id: 'overdue-project-1',
        projectId: 'project-1',
        projectName,
        projectCode: 'NS-01',
        stage: 'CONSTRUCTION',
        targetEndDate: '2026-10-20T00:00:00.000Z',
        daysOverdue: 7,
        responsiblePerson: 'Project lead',
      },
    ],
  },
  workforce: {
    scheduledToday: 12,
    checkedIn: 9,
    missing: 3,
    overtimeMinutes: 0,
    scheduledTodayList: [],
    missingList: [],
    overtimeList: [],
  },
  production: {
    plannedToday: 10,
    actualToday: 6,
    completionPercentage: 60,
    blockedProduction: 2,
    plannedTasksList: [],
    actualTasksList: [],
    blockedTasksList: [],
  },
  materials: { lowStock: 0, missingRequired: 0, pendingDeliveries: 0 },
  finance: { budget: 100, actual: 50, forecast: 80 },
  quality: { failedInspections: 0, openNCRs: 0, pendingCorrections: 0 },
  documentation: {},
  redFlags: [],
});

const criticalFlag = {
  id: 'flag-1',
  severity: 'CRITICAL',
  category: 'PRODUCTION',
  affectedEntity: 'Foundation task',
  reason: 'Blocked work is delaying the critical path',
  responsiblePerson: 'Site lead',
  timestamp: '2026-10-27T08:00:00.000Z',
  sourceRecord: 'TASK-10',
};

describe('ControlTowerSurface', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseAuth.mockReturnValue({ user: { role: 'pm' } });
    mockUseProject.mockReturnValue({
      projects: authorizedProjects,
      loading: false,
      selectedProjectId: 'project-1',
      setSelectedProjectId: jest.fn(),
    });
    mockGetOverview.mockResolvedValue({ data: overview() });
    mockGetRedFlags.mockResolvedValue({ data: [criticalFlag] });
    mockGetActivity.mockResolvedValue({ data: [], error: null });
    mockGetAttendanceRecords.mockResolvedValue({ data: [] });
    mockGetDailyPlans.mockResolvedValue({ data: [] });
    mockGetIssues.mockResolvedValue({ data: [] });
  });

  afterEach(() => jest.clearAllMocks());

  it('uses selected-project scope and renders KPIs from the overview and alerts APIs', async () => {
    render(<ControlTowerSurface />);

    expect(await screen.findByText('North site')).toBeInTheDocument();
    const kpis = screen.getByRole('region', { name: 'control_tower.role_priority' });
    expect(kpis).toHaveTextContent('9');
    expect(kpis).toHaveTextContent('60%');
    expect(kpis).toHaveTextContent('2');
    expect(kpis).toHaveTextContent('1');
    expect(mockGetOverview).toHaveBeenCalledWith('project-1');
    await waitFor(() => expect(mockGetRedFlags).toHaveBeenCalledWith('project-1'));
  });

  it('uses critical alerts for administrators and overdue projects for project managers', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'admin' } });
    render(<ControlTowerSurface />);

    await screen.findByText('North site');
    const kpis = screen.getByRole('region', { name: 'control_tower.role_priority' });
    await waitFor(() => expect(kpis).toHaveTextContent('control_tower.kpi_critical_alerts'));
    expect(kpis).toHaveTextContent('1');
    expect(kpis).not.toHaveTextContent('control_tower.kpi_overdue');
  });

  it('shows procurement and finance KPIs from their own authorized domains', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'procurement' } });
    const procurement = render(<ControlTowerSurface />);
    await screen.findByText('North site');
    const procurementKpis = screen.getByRole('region', { name: 'control_tower.role_priority' });
    expect(procurementKpis).toHaveTextContent('control_tower.low_stock');
    expect(procurementKpis).toHaveTextContent('control_tower.missing_materials');
    expect(procurementKpis).not.toHaveTextContent('control_tower.kpi_attendance');

    procurement.unmount();
    mockUseAuth.mockReturnValue({ user: { role: 'finance' } });
    render(<ControlTowerSurface />);
    await screen.findByText('North site');
    const financeKpis = screen.getByRole('region', { name: 'control_tower.role_priority' });
    expect(financeKpis).toHaveTextContent('control_tower.budget_total');
    expect(financeKpis).toHaveTextContent('control_tower.actual_cost');
    expect(financeKpis).not.toHaveTextContent('control_tower.kpi_attendance');
  });

  it('prioritizes alerts, deduplicates stable IDs, and includes available project and owner context', async () => {
    const user = userEvent.setup();
    mockGetRedFlags.mockResolvedValue({
      data: [
        { ...criticalFlag, id: 'flag-medium', severity: 'MEDIUM', category: 'MATERIALS', affectedEntity: 'Minor stock alert', responsiblePerson: 'Warehouse lead' },
        { ...criticalFlag, id: 'flag-blocked', severity: 'HIGH', category: 'PRODUCTION', affectedEntity: 'Blocked task' },
        { ...criticalFlag, id: 'flag-overdue', severity: 'HIGH', category: 'PROJECTS', entityId: 'project-1', affectedEntity: 'North site overdue' },
        criticalFlag,
        { ...criticalFlag, affectedEntity: 'Duplicate identity should be ignored' },
      ],
    });
    render(<ControlTowerSurface />);

    const alerts = await screen.findByRole('region', { name: 'control_tower.red_flags.section' });
    const foundationAlert = await within(alerts).findByText('Foundation task');
    expect(foundationAlert).toBeInTheDocument();
    expect(within(alerts).getAllByText('Site lead', { exact: false })).toHaveLength(3);
    expect(within(alerts).getAllByText('control_tower.red_flags.project_context: North site')).toHaveLength(4);
    expect(within(alerts).queryByText('Duplicate identity should be ignored')).not.toBeInTheDocument();
    expect(within(alerts).getByRole('button', { name: 'control_tower.show_all_alerts' })).toBeInTheDocument();
    const alertItems = within(alerts).getAllByRole('listitem');
    expect(alertItems).toHaveLength(4);
    expect(foundationAlert.closest('li')).toBe(alertItems[0]);
    expect(alertItems[1]).toHaveTextContent('North site overdue');
    expect(alertItems[1]).toHaveTextContent('control_tower.drawer.overdue');
    expect(alertItems[2]).toHaveTextContent('Blocked task');
    await user.click(within(alerts).getByRole('button', { name: 'control_tower.show_all_alerts' }));
    await user.click(within(alerts).getByRole('button', { name: 'control_tower.red_flags.filter_critical (1)' }));
    expect(within(alerts).queryByText('Minor stock alert')).not.toBeInTheDocument();
  });

  it('shows project lifecycle status and date warnings without implying completion from progress', async () => {
    render(<ControlTowerSurface />);

    const project = await screen.findByRole('progressbar', { name: /North site/ });
    expect(project).toHaveAttribute('aria-valuenow', '42');
    expect(project.closest('li')).toHaveTextContent('Construction');
    expect(project.closest('li')).toHaveTextContent('control_tower.project_overdue_warning');
    expect(project.closest('li')).not.toHaveTextContent('Completed');
  });

  it('flags a COMPLETED lifecycle status paired with low task progress transparently', async () => {
    const inconsistent = overview('Parc Solar Timisoara');
    inconsistent.projects.activeProjectsList[0].stage = 'COMPLETED';
    inconsistent.projects.activeProjectsList[0].progressPercent = 26;
    inconsistent.projects.overdueProjects = 0;
    inconsistent.projects.overdueProjectsList = [];
    inconsistent.projects.upcomingDeadlines = 1;
    inconsistent.projects.upcomingDeadlinesList = [
      {
        id: 'completed-deadline',
        projectId: 'project-1',
        projectName: 'Parc Solar Timisoara',
        projectCode: 'TM-002',
        stage: 'COMPLETED',
        targetDate: '2026-11-15T00:00:00.000Z',
        daysUntilDeadline: 19,
        responsiblePerson: 'Project lead',
      },
    ];
    mockGetOverview.mockResolvedValueOnce({ data: inconsistent });
    render(<ControlTowerSurface />);

    const projectProgress = await screen.findByRole('progressbar', { name: /Parc Solar Timisoara/ });
    const projectRow = projectProgress.closest('li');
    expect(projectProgress).toHaveAttribute('aria-valuenow', '26');
    expect(projectRow).toHaveTextContent('Completed');
    expect(projectRow).toHaveTextContent('control_tower.project_progress_mismatch');
    expect(projectRow).not.toHaveTextContent('control_tower.project_due_soon_warning');
    expect(projectProgress).toHaveAttribute('title', 'control_tower.project_task_progress_definition');
  });

  it('renders authorized map sites as the portfolio selector and keeps selection keyboard-accessible', async () => {
    render(<ControlTowerSurface />);
    await screen.findByText('North site');

    const map = screen.getByRole('region', { name: 'Project map selection' });
    expect(within(map).getByRole('button', { name: 'North site · 45.75 · 21.23' })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: 'South site · no latitude · no longitude' })).toBeInTheDocument();
  });

  it('updates the selected-site detail panel when a project-map list item is selected', async () => {
    const user = userEvent.setup();
    const setSelectedProjectId = jest.fn();
    mockUseProject.mockReturnValue({
      projects: authorizedProjects,
      loading: false,
      selectedProjectId: 'project-1',
      setSelectedProjectId,
    });
    render(<ControlTowerSurface />);

    await user.click(await screen.findByRole('button', { name: 'South site · no latitude · no longitude' }));

    expect(setSelectedProjectId).toHaveBeenCalledWith('project-2');
    expect(screen.getByRole('heading', { name: 'South site' })).toBeInTheDocument();
    expect(screen.getByText('control_tower.map.location_unavailable')).toBeInTheDocument();
  });

  it('replaces duplicate dashboard domain summaries with role-authorized module routes', async () => {
    const user = userEvent.setup();
    render(<ControlTowerSurface />);
    await screen.findByText('North site');

    const modules = screen.getByRole('region', { name: 'control_tower.module_access' });
    await user.click(within(modules).getByRole('button', { name: 'planning.expand' }));
    const moduleLinks = within(modules).getByRole('navigation', { name: 'control_tower.module_access' });
    expect(within(moduleLinks).getByRole('link', { name: 'nav.tasks' })).toHaveAttribute('href', '/tasks');
    expect(within(moduleLinks).getByRole('link', { name: 'nav.qa_qc' })).toHaveAttribute('href', '/qa');
    expect(within(modules).queryByText('control_tower.workforce')).not.toBeInTheDocument();
  });

  it('shows project-specific data after changing the existing site selector', async () => {
    const user = userEvent.setup();
    const setSelectedProjectId = jest.fn();
    mockUseProject.mockReturnValue({ projects: authorizedProjects, loading: false, selectedProjectId: 'project-1', setSelectedProjectId });
    const view = render(<ControlTowerSurface />);

    await screen.findByText('North site');
    await user.selectOptions(screen.getByLabelText('control_tower.project_filter'), 'project-2');
    expect(setSelectedProjectId).toHaveBeenCalledWith('project-2');
    mockUseProject.mockReturnValue({ projects: authorizedProjects, loading: false, selectedProjectId: 'project-2', setSelectedProjectId });
    mockGetOverview.mockResolvedValueOnce({ data: overview('South scoped site') });
    view.rerender(<ControlTowerSurface />);
    expect(await screen.findByText('South scoped site')).toBeInTheDocument();
    await waitFor(() => expect(mockGetOverview).toHaveBeenLastCalledWith('project-2'));
  });

  it('loads the secondary activity list only when expanded and limits the request', async () => {
    const user = userEvent.setup();
    render(<ControlTowerSurface />);

    await screen.findByText('North site');
    expect(mockGetActivity).not.toHaveBeenCalled();
    const activityRegion = screen.getByRole('region', { name: 'control_tower.activity_title' });
    await user.click(within(activityRegion).getByRole('button', { name: 'planning.expand' }));
    await waitFor(() => {
      expect(mockGetActivity).toHaveBeenCalledWith({ projectId: 'project-1', limit: 20 });
    });
  });

  it('renders a real empty state when the scoped API returns no projects', async () => {
    mockGetOverview.mockResolvedValue({ data: overview() });
    mockGetOverview.mockResolvedValueOnce({
      data: { ...overview(), projects: { ...overview().projects, activeProjects: 0, activeProjectsList: [] } },
    });
    render(<ControlTowerSurface />);

    expect(await screen.findByText('control_tower.empty_projects_title')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('renders the API error with a retry action', async () => {
    mockGetOverview.mockRejectedValueOnce(new Error('API unavailable'));
    render(<ControlTowerSurface />);

    expect(await screen.findByRole('alert')).toHaveTextContent('API unavailable');
    expect(screen.getByRole('button', { name: 'control_tower.retry' })).toBeInTheDocument();
  });

  it('requests attendance and daily plans only for the selected authorized site and date', async () => {
    render(<ControlTowerSurface />);

    await waitFor(() => {
      expect(mockGetAttendanceRecords).toHaveBeenCalledWith(expect.objectContaining({
        projectId: 'project-1',
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }));
      expect(mockGetDailyPlans).toHaveBeenCalledWith('project-1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
      expect(mockGetIssues).toHaveBeenCalledWith('project-1');
    });
  });

  it('does not request project-wide attendance for roles without the Attendance route', async () => {
    mockUseAuth.mockReturnValue({ user: { role: 'finance' } });
    render(<ControlTowerSurface />);

    await waitFor(() => expect(mockGetOverview).toHaveBeenCalled());
    expect(mockGetAttendanceRecords).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'site-workforce-title' })).not.toBeInTheDocument();
  });
});
