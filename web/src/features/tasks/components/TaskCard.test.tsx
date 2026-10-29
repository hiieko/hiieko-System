import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext, t } from '@solar/shared';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../types';

const mockOpenPhotoUpload = jest.fn();

jest.mock('../../../contexts/PhotoUploadModalContext', () => ({
  usePhotoUploadModal: () => ({ openPhotoUpload: mockOpenPhotoUpload }),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    project_id: 'project-1',
    title: 'Mount east array',
    code: 'PV-041',
    description: 'Install and torque the east-row modules.',
    status: 'IN_PROGRESS',
    planned_start: '2026-09-01T08:00:00.000Z',
    planned_end: '2026-09-05T08:00:00.000Z',
    planned_quantity: 120,
    actual_quantity: 60,
    unit_of_measure: 'modules',
    created_at: '2026-08-28T08:00:00.000Z',
    updated_at: '2026-09-01T08:00:00.000Z',
    work_package: { id: 'wp-1', name: 'Module installation' },
    zone: { id: 'zone-1', project_id: 'project-1', name: 'East field' },
    assignments: [
      {
        id: 'assignment-1',
        task_id: 'task-1',
        user_id: 'worker-1',
        assigned_at: '2026-08-30T08:00:00.000Z',
        user: {
          id: 'worker-1',
          email: 'worker@example.test',
          fullName: 'Andrei Pop',
          profile: { full_name: 'Andrei Pop' },
        },
      },
    ],
    prerequisites: [],
    dependents: [],
    ...overrides,
  };
}

function makeProps(task = makeTask()) {
  return {
    task,
    currentUserId: 'worker-1',
    canUpdateStatus: true,
    canUpdateQuantity: true,
    canAssign: true,
    canBlock: true,
    onStatusChange: jest.fn<Promise<void>, [string, TaskStatus]>().mockResolvedValue(undefined),
    onQuantityChange: jest.fn<Promise<void>, [string, number]>().mockResolvedValue(undefined),
    onAssignClick: jest.fn(),
    onBlock: jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined),
    onUnblock: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    updatingStatus: false,
    updatingQuantity: false,
    blocking: false,
  };
}

function renderTaskCard(props = makeProps(), locale: 'ro' | 'en' = 'ro') {
  return render(
    <LocaleContext.Provider value={{ locale, setLocale: jest.fn() }}>
      <TaskCard {...props} />
    </LocaleContext.Provider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TaskCard', () => {
  it('presents the real task identity, status, workfront details and measured progress', () => {
    renderTaskCard();

    expect(screen.getByText('PV-041')).toBeInTheDocument();
    const taskName = screen.getByRole('heading', { name: 'Mount east array' });
    const taskStatus = screen.getByText(t('task.status.in_progress', 'ro'));
    expect(taskName).toBeInTheDocument();
    expect(taskName.compareDocumentPosition(taskStatus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(taskName.closest('.bg-white')).not.toHaveClass('border-l-4');
    expect(screen.getByText('Module installation')).toBeInTheDocument();
    expect(screen.getByText('East field')).toBeInTheDocument();
    expect(screen.getByText(/60 \/ 120 modules/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('Andrei Pop')).toBeInTheDocument();
  });

  it('renders task timestamps on the company calendar day', async () => {
    const user = userEvent.setup();
    const props = makeProps(makeTask({
      planned_start: '2026-09-01T22:30:00.000Z',
      planned_end: '2026-09-01T22:30:00.000Z',
    }));
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    const expectedDate = new Intl.DateTimeFormat('ro-RO', { timeZone: 'UTC' })
      .format(new Date('2026-09-02T12:00:00.000Z'));
    expect(document.body).toHaveTextContent(expectedDate);
  });

  it('keeps board cards compact while retaining project, assignee, progress and blocker context', async () => {
    const user = userEvent.setup();
    const onExpandedChange = jest.fn();
    const props = {
      ...makeProps(makeTask({
        project: { id: 'project-1', code: 'BCJ', name: 'Bucecea site' },
        blocked_reason: 'Awaiting cable delivery',
      })),
      variant: 'compact' as const,
      onExpandedChange,
    };
    renderTaskCard(props);

    expect(screen.getByText('BCJ · Bucecea site')).toBeInTheDocument();
    expect(screen.getByText('Module installation · East field')).toBeInTheDocument();
    expect(screen.getByText('Andrei Pop')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.queryByRole('button', { name: /Atribuie/ })).not.toBeInTheDocument();
    expect(screen.getByText('Awaiting cable delivery').closest('.bg-warning-soft')).toBeInTheDocument();
    expect(screen.getByText(t('task.status.in_progress', 'ro'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    expect(onExpandedChange).toHaveBeenCalledWith('task-1', true);
    expect(screen.getByText('Install and torque the east-row modules.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('spinbutton', { name: t('task.actual_quantity', 'ro') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Atribuie/ }));
    expect(props.onAssignClick).toHaveBeenCalledWith(props.task);
  });

  it('does not print a missing-planned-quantity message when the real progress pair is incomplete', () => {
    const props = {
      ...makeProps(makeTask({ planned_quantity: null, actual_quantity: 60 })),
      variant: 'compact' as const,
    };
    renderTaskCard(props);

    expect(screen.queryByText(t('task.no_planned_qty', 'ro'))).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('reveals the existing detail workflow and sends a selected status to the existing callback', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    expect(screen.getByText('Install and torque the east-row modules.')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: t('task.actual_quantity', 'ro') })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('task.status.completed', 'ro') }));
    expect(props.onStatusChange).toHaveBeenCalledWith('task-1', 'COMPLETED');
  });

  it('keeps task cancellation behind the existing irreversible-action confirmation', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    await user.click(screen.getByRole('button', { name: t('task.status.cancelled', 'ro') }));
    const confirmation = screen.getByRole('alertdialog', { name: t('task.confirm_cancel_title', 'ro') });
    expect(within(confirmation).getByText(t('task.confirm_cancel_message', 'ro'))).toBeInTheDocument();
    expect(props.onStatusChange).not.toHaveBeenCalled();

    await user.click(within(confirmation).getByRole('button', { name: t('task.confirm_cancel_confirm', 'ro') }));
    expect(props.onStatusChange).toHaveBeenCalledWith('task-1', 'CANCELLED');
  });

  it('saves actual quantity through the existing callback', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    const quantity = screen.getByRole('spinbutton', { name: t('task.actual_quantity', 'ro') });
    await user.clear(quantity);
    await user.type(quantity, '72');
    await user.keyboard('{Enter}');
    expect(props.onQuantityChange).toHaveBeenCalledWith('task-1', 72);
  });

  it('edits only the existing title/description fields through the persisted update callback', async () => {
    const user = userEvent.setup();
    const onDetailsChange = jest.fn<Promise<boolean>, [string, { title: string; description: string }]>().mockResolvedValue(true);
    const props = { ...makeProps(), canEditDetails: true, onDetailsChange };
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    await user.click(screen.getByRole('button', { name: 'Editează' }));
    const title = screen.getByLabelText(t('task.field_title', 'ro'));
    const description = screen.getByLabelText(t('task.field_description', 'ro'));
    await user.clear(title);
    await user.type(title, 'Install north array');
    await user.clear(description);
    await user.type(description, 'Install and torque the north-row modules.');
    await user.click(screen.getByRole('button', { name: t('general.save', 'ro') }));

    expect(onDetailsChange).toHaveBeenCalledWith('task-1', {
      title: 'Install north array',
      description: 'Install and torque the north-row modules.',
    });
  });

  it('reports a blocker with its reason and can resolve an existing blocker', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    await user.click(screen.getByRole('button', { name: t('task.report_blocker', 'ro') }));
    const dialog = screen.getByRole('dialog', { name: t('task.blocker_modal_title', 'ro') });
    await user.type(within(dialog).getByLabelText(t('task.blocker_reason_label', 'ro')), 'Cable delivery delayed');
    await user.click(within(dialog).getByRole('button', { name: t('task.blocker_submit', 'ro') }));
    expect(props.onBlock).toHaveBeenCalledWith('task-1', 'Cable delivery delayed');

    const blockedProps = makeProps(makeTask({ status: 'BLOCKED', blocked_reason: 'Awaiting inspection' }));
    renderTaskCard(blockedProps);
    expect(screen.getByText('Awaiting inspection').closest('.bg-warning-soft')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    await user.click(screen.getByRole('button', { name: t('task.blocker_unblock', 'ro') }));
    expect(blockedProps.onUnblock).toHaveBeenCalledWith('task-1');
  });

  it('keeps assignment and photo attachment on their existing callbacks and target IDs', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    renderTaskCard(props);

    await user.click(screen.getByRole('button', { name: /Atribuie/ }));
    expect(props.onAssignClick).toHaveBeenCalledWith(props.task);

    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    await user.click(screen.getByRole('button', { name: 'Fotografii' }));
    expect(mockOpenPhotoUpload).toHaveBeenCalledWith({
      targetType: 'task',
      targetId: 'task-1',
      projectId: 'project-1',
    });
  });

  it('does not expose mutation controls when the page supplies read-only permissions', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    props.canUpdateStatus = false;
    props.canUpdateQuantity = false;
    props.canAssign = false;
    props.canBlock = false;
    renderTaskCard(props);

    expect(screen.queryByRole('button', { name: /Atribuie/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('task.expand_details', 'ro') }));
    expect(screen.queryByRole('spinbutton', { name: t('task.actual_quantity', 'ro') })).not.toBeInTheDocument();
    expect(screen.queryByText(t('task.update_status', 'ro'))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('task.report_blocker', 'ro') })).not.toBeInTheDocument();
  });
});
