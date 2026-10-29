import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext, t } from '@solar/shared';

import { createTask } from '../api';
import { getProject, getProjectStages } from '../../projects/api';
import type { Task } from '../types';
import { TaskCreateModal } from './TaskCreateModal';

jest.mock('../api', () => ({ createTask: jest.fn() }));
jest.mock('../../projects/api', () => ({
  getProject: jest.fn(),
  getProjectStages: jest.fn(),
}));

const mockedCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockedGetProject = getProject as jest.MockedFunction<typeof getProject>;
const mockedGetProjectStages = getProjectStages as jest.MockedFunction<typeof getProjectStages>;

const TASK: Task = {
  id: 'task-1',
  project_id: 'project-1',
  title: 'Mount east array',
  code: 'PV-041',
  status: 'PLANNED',
  planned_start: '2026-10-10',
  planned_end: '2026-10-12',
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetProjectStages.mockResolvedValue({ data: [] });
  mockedGetProject.mockResolvedValue({ data: { zones: [] } } as never);
  mockedCreateTask.mockResolvedValue({ data: TASK });
});

it('submits the real planned schedule and rejects a reversed date range', async () => {
  const user = userEvent.setup();
  const onCreated = jest.fn();
  const onClose = jest.fn();

  render(
    <LocaleContext.Provider value={{ locale: 'ro', setLocale: jest.fn() }}>
      <TaskCreateModal
        open
        onClose={onClose}
        projectId="project-1"
        onCreated={onCreated}
      />
    </LocaleContext.Provider>,
  );

  await user.type(await screen.findByPlaceholderText(t('task.field_title', 'ro')), TASK.title);
  fireEvent.change(screen.getByLabelText(t('task.planned_start', 'ro')), {
    target: { value: '2026-10-10' },
  });
  fireEvent.change(screen.getByLabelText(t('task.planned_end', 'ro')), {
    target: { value: '2026-10-09' },
  });

  await user.click(screen.getByRole('button', { name: t('task.create', 'ro') }));

  expect(screen.getByRole('alert')).toHaveTextContent(t('task.err_date_order', 'ro'));
  expect(mockedCreateTask).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText(t('task.planned_start', 'ro')), {
    target: { value: '2026-10-08' },
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(t('task.planned_end', 'ro')), {
    target: { value: '2026-10-12' },
  });
  await user.click(screen.getByRole('button', { name: t('task.create', 'ro') }));

  await waitFor(() => {
    expect(mockedCreateTask).toHaveBeenCalledWith({
      projectId: 'project-1',
      title: TASK.title,
      plannedStart: '2026-10-08',
      plannedEnd: '2026-10-12',
    });
  });
  expect(onCreated).toHaveBeenCalledWith(TASK);
  expect(onClose).toHaveBeenCalled();
});

it('removes the manual code field and explains automatic generation', async () => {
  render(
    <LocaleContext.Provider value={{ locale: 'ro', setLocale: jest.fn() }}>
      <TaskCreateModal
        open
        onClose={jest.fn()}
        projectId="project-1"
        onCreated={jest.fn()}
      />
    </LocaleContext.Provider>,
  );

  expect(await screen.findByText(t('task.code_auto', 'ro'))).toBeInTheDocument();
  expect(screen.queryByLabelText(t('task.field_code', 'ro'))).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: t('task.section_basic', 'ro') }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: t('task.section_assignment', 'ro') }),
  ).toBeInTheDocument();
});

it('submits the existing optional work package, zone, quantity and unit fields', async () => {
  const user = userEvent.setup();
  mockedGetProjectStages.mockResolvedValue({
    data: [{
      id: 'stage-1',
      name: 'Stage A',
      work_packages: [{ id: 'wp-1', name: 'Module installation' }],
    }],
  } as never);
  mockedGetProject.mockResolvedValue({
    data: { zones: [{ id: 'zone-1', name: 'East field' }] },
  } as never);

  render(
    <LocaleContext.Provider value={{ locale: 'ro', setLocale: jest.fn() }}>
      <TaskCreateModal
        open
        onClose={jest.fn()}
        projectId="project-1"
        onCreated={jest.fn()}
      />
    </LocaleContext.Provider>,
  );

  await user.type(await screen.findByPlaceholderText(t('task.field_title', 'ro')), TASK.title);
  await user.selectOptions(await screen.findByLabelText(t('task.field_work_package', 'ro')), 'wp-1');
  await user.selectOptions(screen.getByLabelText(t('task.field_zone', 'ro')), 'zone-1');
  await user.type(screen.getByLabelText(t('task.field_planned_qty', 'ro')), '120');
  await user.type(screen.getByLabelText(t('task.field_uom', 'ro')), 'modules');
  await user.click(screen.getByRole('button', { name: t('task.create', 'ro') }));

  await waitFor(() => {
    expect(mockedCreateTask).toHaveBeenCalledWith({
      projectId: 'project-1',
      title: TASK.title,
      workPackageId: 'wp-1',
      zoneId: 'zone-1',
      plannedQuantity: 120,
      unitOfMeasure: 'modules',
    });
  });
});

