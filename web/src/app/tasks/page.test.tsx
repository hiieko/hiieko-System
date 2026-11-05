import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext, t } from '@solar/shared';
import { ToastProvider } from '../../components/ui/Toast';
import TasksPage from './page';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getTasks } from '../../features/tasks/api';
import { TASK_STATUSES, TASK_STATUS_I18N } from '../../features/tasks/types';
import type { Task } from '../../features/tasks/types';
import { formatTaskCalendarDate } from '../../features/tasks/components/TaskCalendar';
import { shiftCompanyDate, todayCompanyIso } from '../../lib/company-time';

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/ProjectContext', () => ({ useProject: jest.fn() }));
jest.mock('../../hooks/useMediaQuery', () => ({ useMediaQuery: jest.fn() }));
jest.mock('../../features/tasks/api', () => ({
  getTasks: jest.fn(),
  updateTask: jest.fn(),
  blockTask: jest.fn(),
  unblockTask: jest.fn(),
}));

jest.mock('../../features/tasks/components/TaskCard', () => {
  const React = require('react');
  return {
    TaskCard: ({
      task,
      onExpandedChange,
      variant,
      expanded: expandedProp,
    }: {
      task: Task;
      onExpandedChange?: (taskId: string, expanded: boolean) => void;
      variant?: string;
      expanded?: boolean;
    }) => {
      const [internalExpanded, setInternalExpanded] = React.useState(false);
      const expanded = expandedProp ?? internalExpanded;
      return React.createElement('article', {
        'data-testid': 'task-card',
        'data-variant': variant,
      }, [
        React.createElement('span', { key: 'title' }, task.title),
        React.createElement('button', {
          key: 'disclosure',
          type: 'button',
          'aria-expanded': expanded,
          onClick: () => {
            const next = !expanded;
            if (expandedProp === undefined) setInternalExpanded(next);
            onExpandedChange?.(task.id, next);
          },
        }, 'Task details'),
        ...(expanded && task.description
          ? [React.createElement('p', { key: 'description' }, task.description)]
          : []),
      ]);
    },
  };
});

const mockedUseAuth = useAuth as unknown as jest.Mock;
const mockedUseProject = useProject as unknown as jest.Mock;
const mockedUseMediaQuery = useMediaQuery as jest.MockedFunction<typeof useMediaQuery>;
const mockedGetTasks = getTasks as jest.MockedFunction<typeof getTasks>;

const PROJECT = {
  id: 'project-1',
  name: 'Bucecea 0.9 MW',
  code: 'BCJ',
  is_active: true,
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    project_id: PROJECT.id,
    title: 'Mount east array',
    code: 'PV-041',
    status: 'IN_PROGRESS',
    created_at: '2026-09-01T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
    assignments: [{
      id: `assignment-${overrides.id || 'task-1'}`,
      task_id: overrides.id || 'task-1',
      user_id: 'user-1',
      assigned_at: '2026-09-01T08:00:00.000Z',
    }],
    ...overrides,
  };
}

function renderPage(options: {
  role?: string;
  project?: typeof PROJECT | null;
  locale?: 'ro' | 'en';
  mobile?: boolean;
} = {}) {
  const { role = 'manager', project = PROJECT, locale = 'ro', mobile = false } = options;
  mockedUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'manager@example.test', role },
    loading: false,
    signOut: jest.fn(),
    refreshUser: jest.fn(),
  });
  mockedUseProject.mockReturnValue({ selectedProject: project });
  mockedUseMediaQuery.mockReturnValue(mobile);

  return render(
    <LocaleContext.Provider value={{ locale, setLocale: jest.fn() }}>
      <ToastProvider>
        <TasksPage />
      </ToastProvider>
    </LocaleContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetTasks.mockResolvedValue({ data: [makeTask()] });
  mockedUseMediaQuery.mockReturnValue(false);
});

describe('production /tasks page', () => {
  it('shows the initial loading summary while the task request is pending', async () => {
    const user = userEvent.setup();
    let resolveTasks!: (value: { data: Task[] }) => void;
    mockedGetTasks.mockReturnValue(new Promise((resolve) => { resolveTasks = resolve; }));
    renderPage();

    expect(screen.getByTestId('tasks-board-loading')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Listă' }));
    expect(screen.getByTestId('tasks-list-loading')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4);
    await act(async () => resolveTasks({ data: [makeTask()] }));
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
  });

  it('loads real task fields through the selected-project API and shows live counts', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
    expect(screen.getByText('BCJ — Bucecea 0.9 MW')).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledWith(PROJECT.id);
    await user.click(screen.getByRole('button', { name: 'Listă' }));
    const summaries = within(screen.getByRole('region', { name: t('task.summary_total', 'ro') }));
    expect(summaries.getByText(t('task.summary_total', 'ro'))).toBeInTheDocument();
    expect(summaries.getByText(t('task.summary_active', 'ro'))).toBeInTheDocument();
    expect(summaries.getByText(t('task.summary_blocked', 'ro'))).toBeInTheDocument();
    expect(summaries.getByText(t('task.summary_complete', 'ro'))).toBeInTheDocument();
  });

  it('groups fetched tasks into every actual status lane with filtered counts', async () => {
    mockedGetTasks.mockResolvedValue({
      data: TASK_STATUSES.map((status, index) => makeTask({
        id: `task-${index}`,
        code: `PV-${index}`,
        title: `Task ${status}`,
        status,
      })),
    });
    renderPage();

    expect(await screen.findByText('Task PLANNED')).toBeInTheDocument();
    const board = screen.getByTestId('tasks-board-view');
    expect(within(board).getAllByRole('region')).toHaveLength(TASK_STATUSES.length);
    for (const status of TASK_STATUSES) {
      const column = within(board).getByRole('region', { name: t(TASK_STATUS_I18N[status], 'ro') });
      expect(within(column).getByText('1')).toBeInTheDocument();
      expect(within(column).getByText(`Task ${status}`)).toBeInTheDocument();
    }
    expect(within(board).getByTestId('tasks-board-scroll')).toHaveClass('overflow-y-auto');
    expect(within(board).getAllByTestId('task-card')).toHaveLength(TASK_STATUSES.length);
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('switches Board/List without refetching and applies search in both views', async () => {
    const user = userEvent.setup();
    mockedGetTasks.mockResolvedValue({
      data: [
        makeTask({ id: 'task-1', title: 'Mount east array' }),
        makeTask({ id: 'task-2', title: 'Inspect inverter', status: 'READY' }),
      ],
    });
    renderPage();
    expect(await screen.findByText('Inspect inverter')).toBeInTheDocument();

    const boardToggle = screen.getByRole('group', { name: 'Vizualizare task-uri' });
    expect(within(boardToggle).getByRole('button', { name: 'Kanban' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(boardToggle).getByRole('button', { name: 'Listă' }));
    expect(screen.queryByTestId('tasks-board-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('tasks-list-view')).toBeInTheDocument();
    expect(screen.getAllByTestId('task-card')).toHaveLength(2);

    const search = screen.getByRole('textbox', { name: t('task.search_placeholder', 'ro') });
    await user.type(search, 'inverter');
    expect(screen.getByText('Inspect inverter')).toBeInTheDocument();
    expect(screen.queryByText('Mount east array')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Gata de start/ }));
    expect(screen.getByText('Inspect inverter')).toBeInTheDocument();

    await user.click(within(boardToggle).getByRole('button', { name: 'Kanban' }));
    const board = screen.getByTestId('tasks-board-view');
    expect(within(board).getByText('Inspect inverter')).toBeInTheDocument();
    expect(within(board).queryByText('Mount east array')).not.toBeInTheDocument();
    expect(within(board).getAllByRole('region')).toHaveLength(1);
    expect(within(board).getByRole('region', { name: t('task.status.ready', 'ro') })).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('shows real planned dates and undated tasks in Calendar without issuing another request', async () => {
    const user = userEvent.setup();
    const today = todayCompanyIso();
    mockedGetTasks.mockResolvedValue({
      data: [
        makeTask({
          id: 'calendar-task',
          title: 'Plan east cable run',
          planned_start: `${today}T08:00:00.000Z`,
          planned_end: `${shiftCompanyDate(today, 2)}T08:00:00.000Z`,
        }),
        makeTask({ id: 'calendar-undated', title: 'Review material delivery' }),
      ],
    });
    renderPage();
    expect(await screen.findByText('Plan east cable run')).toBeInTheDocument();

    const toggle = screen.getByRole('group', { name: 'Vizualizare task-uri' });
    await user.click(within(toggle).getByRole('button', { name: 'Calendar' }));
    const calendar = screen.getByTestId('tasks-calendar-view');
    expect(calendar).toBeInTheDocument();
    const event = within(calendar).getByRole('button', { name: /Plan east cable run/ });
    expect(event).toHaveTextContent(t('task.status.in_progress', 'ro'));
    await user.click(event);

    const selectedDay = screen.getByTestId('tasks-calendar-selection');
    expect(within(selectedDay).getByText('Plan east cable run')).toBeInTheDocument();
    expect(within(selectedDay).getByRole('button', { name: 'Task details' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Luna precedentă' })).toBeEnabled();
    expect(within(toggle).getByRole('button', { name: 'Calendar' })).toBeEnabled();
    const unscheduled = screen.getByRole('heading', { name: 'Task-uri fără date planificate' });
    expect(unscheduled).toBeInTheDocument();
    expect(screen.getByText('Review material delivery')).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('filters Calendar by an actual assignee and by unassigned tasks', async () => {
    const user = userEvent.setup();
    const today = todayCompanyIso();
    mockedGetTasks.mockResolvedValue({
      data: [
        makeTask({
          id: 'assigned-calendar-task',
          title: 'Assigned rail inspection',
          planned_start: `${today}T08:00:00.000Z`,
          assignments: [{
            id: 'assignment-assignee-1',
            task_id: 'assigned-calendar-task',
            user_id: 'assignee-1',
            assigned_at: `${today}T08:00:00.000Z`,
            user: {
              id: 'assignee-1',
              email: 'alex.marin@example.test',
              fullName: 'Alex Marin',
              profile: { full_name: 'Alex Marin' },
            },
          }],
        }),
        makeTask({
          id: 'unassigned-calendar-task',
          title: 'Unassigned panel inspection',
          planned_start: `${today}T10:00:00.000Z`,
          assignments: [],
        }),
      ],
    });
    renderPage();
    expect(await screen.findByText('Assigned rail inspection')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Calendar' }));

    const assigneeFilter = screen.getByRole('combobox', { name: 'Filtrează după responsabil' });
    expect(within(assigneeFilter).getByRole('option', { name: 'Alex Marin' })).toBeInTheDocument();
    await user.selectOptions(assigneeFilter, 'assignee-1');
    let calendar = screen.getByTestId('tasks-calendar-view');
    expect(within(calendar).getByRole('button', { name: /Assigned rail inspection/ })).toBeInTheDocument();
    expect(within(calendar).queryByRole('button', { name: /Unassigned panel inspection/ })).not.toBeInTheDocument();

    await user.selectOptions(assigneeFilter, 'unassigned');
    calendar = screen.getByTestId('tasks-calendar-view');
    expect(within(calendar).getByRole('button', { name: /Unassigned panel inspection/ })).toBeInTheDocument();
    expect(within(calendar).queryByRole('button', { name: /Assigned rail inspection/ })).not.toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('switches views while task details are expanded without discarding the expanded task', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
    const toggle = screen.getByRole('group', { name: 'Vizualizare task-uri' });
    await user.click(within(screen.getByTestId('tasks-board-view')).getByRole('button', { name: 'Task details' }));

    expect(within(toggle).getByRole('button', { name: 'Listă' })).toBeEnabled();
    expect(within(toggle).getByRole('button', { name: 'Calendar' })).toBeEnabled();
    expect(screen.queryByText(/Așteaptă finalizarea acțiunii/)).not.toBeInTheDocument();

    await user.click(within(toggle).getByRole('button', { name: 'Listă' }));
    expect(screen.getByTestId('tasks-list-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Task details' })).toHaveAttribute('aria-expanded', 'true');
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('shows a calendar event once on its planned start date and keeps the range available on selection', async () => {
    const user = userEvent.setup();
    const today = todayCompanyIso();
    const insideRangeDate = shiftCompanyDate(today, 1);
    mockedGetTasks.mockResolvedValue({
      data: [makeTask({
        id: 'multi-day-task',
        title: 'Span east mounting work',
        planned_start: `${today}T08:00:00.000Z`,
        planned_end: `${shiftCompanyDate(today, 2)}T08:00:00.000Z`,
      })],
    });
    renderPage();
    expect(await screen.findByText('Span east mounting work')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Calendar' }));

    const calendar = screen.getByTestId('tasks-calendar-view');
    const event = within(calendar).getByRole('button', { name: /Span east mounting work/ });
    expect(within(calendar).getAllByRole('button', { name: /Span east mounting work/ })).toHaveLength(1);
    expect(event).toHaveTextContent('Span east mounting work');
    expect(event).toHaveTextContent('Planificat');
    await user.click(event);

    let selectedDateTasks = screen.getByTestId('tasks-calendar-selection');
    expect(within(selectedDateTasks).getByText('Span east mounting work')).toBeInTheDocument();
    await user.click(within(selectedDateTasks).getByRole('button', { name: 'Task details' }));

    const insideRangeCell = within(calendar).getByRole('gridcell', {
      name: formatTaskCalendarDate(insideRangeDate, 'ro', true),
    });
    await user.click(within(insideRangeCell).getByRole('button', { name: String(Number(insideRangeDate.slice(-2))) }));

    selectedDateTasks = screen.getByTestId('tasks-calendar-selection');
    expect(within(selectedDateTasks).getByText('Span east mounting work')).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('keeps the no-selected-project request membership-scoped and disables task creation', async () => {
    renderPage({ project: null });

    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('button', { name: t('task.new', 'ro') })).toBeDisabled();
  });

  it('keeps toolbar and status tabs together above the board without horizontal scrolling', async () => {
    renderPage();
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();

    const heading = screen.getByRole('heading', { level: 1, name: t('task.page_title', 'ro') });
    const route = screen.getByTestId('tasks-route');
    const toolbar = screen.getByTestId('tasks-toolbar');
    const filterRow = within(toolbar).getByTestId('tasks-filter-row');
    const statusTabs = within(toolbar).getByRole('button', { name: /Toate/ });
    const board = screen.getByTestId('tasks-board-view');
    const boardScroller = within(board).getByTestId('tasks-board-scroll');
    const firstColumn = within(board).getAllByRole('region')[0];

    expect(toolbar).toHaveClass('sticky', 'top-0');
    expect(route).toHaveClass('lg:left-[calc(50%_-_0.5rem)]');
    expect(route).toHaveClass('lg:w-[calc(100vw_-_var(--hii-sidebar-width)_-_1rem)]');
    expect(toolbar).toContainElement(heading);
    expect(filterRow).toHaveClass('xl:grid-cols-[17.5rem_minmax(0,1fr)_auto]');
    expect(within(filterRow).getByTestId('task-status-tabs')).toContainElement(statusTabs);
    expect(toolbar).toContainElement(statusTabs);
    expect(toolbar.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(boardScroller).toHaveClass('overflow-y-auto');
    expect(boardScroller).not.toHaveClass('overflow-x-auto');
    expect(boardScroller).not.toHaveClass('overflow-y-hidden');
    expect(firstColumn).toHaveClass('w-[303px]', 'p-3.5', 'bg-slate-100');
  });

  it('filters the fetched list by search, status and only-mine without changing the API request', async () => {
    const user = userEvent.setup();
    mockedGetTasks.mockResolvedValue({
      data: [
        makeTask({
          id: 'task-1',
          title: 'Mount east array',
          status: 'IN_PROGRESS',
          assignments: [{ id: 'a1', task_id: 'task-1', user_id: 'user-1', assigned_at: '2026-09-01' }],
        }),
        makeTask({
          id: 'task-2',
          title: 'Inspect inverter pad',
          code: 'EL-008',
          status: 'READY',
          assignments: [{ id: 'a2', task_id: 'task-2', user_id: 'user-2', assigned_at: '2026-09-01' }],
        }),
      ],
    });
    renderPage();

    expect(await screen.findByText('Inspect inverter pad')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('task.only_mine', 'ro') }));
    expect(screen.getByText('Mount east array')).toBeInTheDocument();
    expect(screen.queryByText('Inspect inverter pad')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Gata de start/ }));
    expect(screen.queryByText('Mount east array')).not.toBeInTheDocument();
    expect(screen.queryByText('Inspect inverter pad')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('task.clear_filters', 'ro') }));
    const search = screen.getByRole('textbox', { name: t('task.search_placeholder', 'ro') });
    await user.type(search, 'inverter');
    expect(screen.getByText('Inspect inverter pad')).toBeInTheDocument();
    expect(screen.queryByText('Mount east array')).not.toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('paginates the authorized in-memory task list', async () => {
    const user = userEvent.setup();
    mockedGetTasks.mockResolvedValue({
      data: Array.from({ length: 21 }, (_, index) =>
        makeTask({
          id: `task-${index + 1}`,
          code: `PV-${String(index + 1).padStart(3, '0')}`,
          title: `Mount row ${index + 1}`,
        }),
      ),
    });
    renderPage();

    expect(await screen.findByText('Mount row 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Listă' }));
    expect(screen.queryByText('Mount row 21')).not.toBeInTheDocument();
    const pagination = screen.getByRole('navigation', { name: t('pagination.label', 'ro') });
    await user.click(within(pagination).getAllByRole('button')[1]);
    expect(screen.getByText('Mount row 21')).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a project with no tasks from search results with no matches', async () => {
    const user = userEvent.setup();
    mockedGetTasks.mockResolvedValue({ data: [] });
    const emptyRender = renderPage();

    expect(await screen.findByText(t('task.empty_desc_create', 'ro'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('task.create', 'ro') })).toBeInTheDocument();

    mockedGetTasks.mockResolvedValue({ data: [makeTask()] });
    emptyRender.unmount();
    renderPage();
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: t('task.search_placeholder', 'ro') }), 'no match');
    expect(await screen.findByText(t('task.empty_none', 'ro'))).toBeInTheDocument();
    expect(screen.getByText(t('task.empty_desc_filtered', 'ro'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('task.clear_filters', 'ro') })).toBeInTheDocument();
  });

  it('shows a load error and retries with the same selected project', async () => {
    const user = userEvent.setup();
    mockedGetTasks
      .mockRejectedValueOnce(new Error('temporary network issue'))
      .mockResolvedValueOnce({ data: [makeTask()] });
    renderPage();

    expect(await screen.findByText(t('task.load_error', 'ro'))).toBeInTheDocument();
    expect(screen.getByText('temporary network issue')).toBeInTheDocument();
    const retryLabel = t('general.retry', 'ro');
    await user.click(screen.getByRole('button', { name: retryLabel }));
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
    expect(mockedGetTasks).toHaveBeenNthCalledWith(1, PROJECT.id);
    expect(mockedGetTasks).toHaveBeenNthCalledWith(2, PROJECT.id);
  });

  it('retains role-specific actions and redirects roles outside the route contract', async () => {
    mockedGetTasks.mockResolvedValue({ data: [makeTask({ assignments: [{
      id: 'assignment-worker',
      task_id: 'task-1',
      user_id: 'user-1',
      assigned_at: '2026-09-01T08:00:00.000Z',
    }] })] });
    const { unmount } = renderPage({ role: 'worker' });
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('task.new', 'ro') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('task.only_mine', 'ro') })).not.toBeInTheDocument();
    unmount();

    mockedGetTasks.mockClear();
    renderPage({ role: 'viewer' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockedGetTasks).not.toHaveBeenCalled();
  });

  it('uses the existing bottom filter drawer at narrow mobile-web widths', async () => {
    const user = userEvent.setup();
    renderPage({ mobile: true });
    expect(await screen.findByText('Mount east array')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: new RegExp(t('task.filters', 'ro')) }));
    const filterDrawer = within(screen.getByRole('dialog', { name: t('task.filters', 'ro') }));
    expect(filterDrawer.getByRole('textbox', { name: t('task.search_placeholder', 'ro') })).toBeInTheDocument();
  });
});
