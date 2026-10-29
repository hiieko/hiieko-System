import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleContext } from '@solar/shared';

import { assignTask } from '../api';
import { getProjectMembers } from '../../projects/api';
import type { ProjectMember } from '../../projects/types';
import type { Task } from '../types';
import { TaskAssignModal } from './TaskAssignModal';

jest.mock('../api', () => ({ assignTask: jest.fn() }));
jest.mock('../../projects/api', () => ({ getProjectMembers: jest.fn() }));

const mockedAssignTask = assignTask as jest.MockedFunction<typeof assignTask>;
const mockedGetProjectMembers = getProjectMembers as jest.MockedFunction<typeof getProjectMembers>;

const TASK: Task = {
  id: 'task-1',
  project_id: 'project-1',
  title: 'Mount east array',
  code: 'PV-041',
  status: 'PLANNED',
  created_at: '2026-10-01T08:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
  assignments: [],
};

const MEMBER: ProjectMember = {
  id: 'member-1',
  project_id: 'project-1',
  user_id: 'worker-1',
  role: 'WORKER',
  assigned_at: '2026-10-01T08:00:00.000Z',
  user: {
    id: 'worker-1',
    email: 'alex.marin@example.test',
    role: 'WORKER',
    fullName: 'Alex Marin',
    profile: { full_name: 'Alex Marin' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetProjectMembers.mockResolvedValue({ data: [MEMBER] });
  mockedAssignTask.mockResolvedValue({
    data: {
      id: 'assignment-1',
      task_id: TASK.id,
      user_id: MEMBER.user_id,
      assigned_at: '2026-10-24T08:00:00.000Z',
    },
  });
});

it('keeps the real project-member identity on the locally updated assignment', async () => {
  const user = userEvent.setup();
  const onAssigned = jest.fn();
  const onClose = jest.fn();
  render(
    <LocaleContext.Provider value={{ locale: 'en', setLocale: jest.fn() }}>
      <TaskAssignModal open onClose={onClose} task={TASK} onAssigned={onAssigned} />
    </LocaleContext.Provider>,
  );

  await user.click(await screen.findByRole('button', { name: /Alex Marin/ }));

  expect(mockedGetProjectMembers).toHaveBeenCalledWith(TASK.project_id);
  expect(mockedAssignTask).toHaveBeenCalledWith(TASK.id, MEMBER.user_id);
  expect(onAssigned).toHaveBeenCalledWith(expect.objectContaining({
    id: TASK.id,
    assignments: [expect.objectContaining({
      user_id: MEMBER.user_id,
      user: expect.objectContaining({
        fullName: 'Alex Marin',
        profile: expect.objectContaining({ full_name: 'Alex Marin' }),
      }),
    })],
  }));
  expect(onClose).toHaveBeenCalled();
});
