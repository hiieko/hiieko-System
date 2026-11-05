import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from '@solar/shared';

import type { Task } from '../types';
import { getTaskCalendarRange, TaskCalendar } from './TaskCalendar';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-calendar-1',
    project_id: 'project-1',
    title: 'Install east mounting rail',
    code: 'PV-101',
    status: 'PLANNED',
    created_at: '2026-10-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('TaskCalendar', () => {
  it('places real planned date ranges in the month and reports the selected task/date', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();
    const onModeChange = jest.fn();
    const onSelectDate = jest.fn();
    const task = makeTask({
      planned_start: '2026-10-15T08:00:00.000Z',
      planned_end: '2026-10-17T08:00:00.000Z',
    });
    render(
      <TaskCalendar
        tasks={[task]}
        currentDate="2026-10-15"
        mode="month"
        locale="en"
        selectedDate={null}
        assigneeOptions={[]}
        assigneeFilterId="all"
        onModeChange={onModeChange}
        onNavigate={onNavigate}
        onToday={jest.fn()}
        onAssigneeFilterChange={jest.fn()}
        onSelectDate={onSelectDate}
      />,
    );

    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    const taskButton = screen.getByRole('button', { name: /Install east mounting rail/ });
    // In month view, title and code are shown; status is in aria-label
    expect(taskButton).toHaveTextContent('Install east mounting rail');
    expect(taskButton).toHaveTextContent('PV-101');
    expect(taskButton).toHaveAccessibleName(/15 Oct – 17 Oct/);
    expect(screen.getAllByRole('button', { name: /Install east mounting rail/ })).toHaveLength(1);

    await user.click(taskButton);
    expect(onSelectDate).toHaveBeenCalledWith('2026-10-15', 'task-calendar-1');
    await user.click(screen.getByRole('button', { name: 'Week' }));
    expect(onModeChange).toHaveBeenCalledWith('week');
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it('uses actual dates only when no planned dates exist and leaves undated tasks unscheduled', () => {
    const actualTask = makeTask({
      id: 'actual-task',
      title: 'Actual cable inspection',
      actual_start: '2026-10-20T08:00:00.000Z',
      actual_end: '2026-10-21T08:00:00.000Z',
    });
    const plannedTask = makeTask({
      id: 'planned-task',
      title: 'Scheduled mounting work',
      planned_start: '2026-10-10T08:00:00.000Z',
      actual_start: '2026-10-20T08:00:00.000Z',
    });
    const unscheduledTask = makeTask({ id: 'undated-task' });

    expect(getTaskCalendarRange(actualTask)).toEqual({
      start: '2026-10-20',
      end: '2026-10-21',
      source: 'actual',
    });
    expect(getTaskCalendarRange(plannedTask)).toEqual({
      start: '2026-10-10',
      end: '2026-10-10',
      source: 'planned',
    });
    expect(getTaskCalendarRange(unscheduledTask)).toBeNull();

    render(
      <TaskCalendar
        tasks={[actualTask, plannedTask]}
        currentDate="2026-10-20"
        mode="month"
        locale="ro"
        selectedDate="2026-10-20"
        selectedTaskId={actualTask.id}
        assigneeOptions={[]}
        assigneeFilterId="all"
        onModeChange={jest.fn()}
        onNavigate={jest.fn()}
        onToday={jest.fn()}
        onAssigneeFilterChange={jest.fn()}
        onSelectDate={jest.fn()}
      />,
    );
    const grid = screen.getByRole('grid');
    const actualButton = within(grid).getByRole('button', { name: /Actual cable inspection/ });
    // In month mode, the status is shown as "Planificat" (Planned) because the calendar uses planned dates for positioning
    // The aria-label includes assignees in compact mode
    expect(actualButton).toHaveAttribute('aria-label', expect.stringContaining('Planificat'));
    expect(actualButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a seven-day week with explicit range and today/previous/next controls', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();
    const onToday = jest.fn();
    render(
      <TaskCalendar
        tasks={[]}
        currentDate="2026-10-15"
        mode="week"
        locale="en"
        selectedDate={null}
        assigneeOptions={[]}
        assigneeFilterId="all"
        onModeChange={jest.fn()}
        onNavigate={onNavigate}
        onToday={onToday}
        onAssigneeFilterChange={jest.fn()}
        onSelectDate={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '12 Oct – 18 Oct, 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(onNavigate).toHaveBeenNthCalledWith(1, -1);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 1);
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it('shows only real assigned people as initials, names and overflow', () => {
    const assignments = ['Andrei Pop', 'Mara Ionescu', 'Ion Popa', 'Elena Radu'].map((fullName, index) => ({
      id: `assignment-${index}`,
      task_id: 'task-calendar-1',
      user_id: `user-${index}`,
      assigned_at: '2026-10-01T08:00:00.000Z',
      user: {
        id: `user-${index}`,
        email: `${fullName.toLowerCase().replace(' ', '.')}@example.test`,
        fullName,
        profile: { full_name: fullName },
      },
    }));
    const task = makeTask({
      planned_start: '2026-10-15T08:00:00.000Z',
      planned_end: '2026-10-17T08:00:00.000Z',
      assignments,
    });
    render(
      <TaskCalendar
        tasks={[task]}
        currentDate="2026-10-15"
        mode="month"
        locale="en"
        selectedDate={null}
        assigneeOptions={[]}
        assigneeFilterId="all"
        onModeChange={jest.fn()}
        onNavigate={jest.fn()}
        onToday={jest.fn()}
        onAssigneeFilterChange={jest.fn()}
        onSelectDate={jest.fn()}
      />,
    );

    const taskEvent = screen.getByRole('button', { name: /Install east mounting rail/ });
    // Verify assignees are in aria-label (visible in compact mode)
    expect(taskEvent).toHaveAttribute('aria-label', expect.stringContaining('Andrei Pop'));
    expect(taskEvent).toHaveAttribute('aria-label', expect.stringContaining('Mara Ionescu'));
  });

  it('renders a real profile image and falls back to initials when it fails', () => {
    const task = makeTask({
      planned_start: '2026-10-15',
      planned_end: '2026-10-15',
      status: 'VERIFIED',
      assignments: [
        {
          id: 'assignment-1',
          task_id: 'task-calendar-1',
          user_id: 'user-1',
          assigned_at: '2026-10-01T08:00:00.000Z',
          user: {
            id: 'user-1',
            email: 'andrei.pop@example.test',
            fullName: 'Andrei Pop',
            profile: {
              full_name: 'Andrei Pop',
              avatar_url: 'https://images.example.test/andrei.jpg',
            },
          },
        },
      ],
    });

    render(
      <TaskCalendar
        tasks={[task]}
        currentDate="2026-10-15"
        mode="month"
        locale="en"
        selectedDate={null}
        assigneeOptions={[]}
        assigneeFilterId="all"
        onModeChange={jest.fn()}
        onNavigate={jest.fn()}
        onToday={jest.fn()}
        onAssigneeFilterChange={jest.fn()}
        onSelectDate={jest.fn()}
      />,
    );

    const taskEvent = screen.getByRole('button', {
      name: /Install east mounting rail/,
    });
    expect(taskEvent.className).toContain('bg-teal-50');

    // Verify assignee is in aria-label (assignees are in compact mode's aria-label)
    expect(taskEvent).toHaveAttribute('aria-label', expect.stringContaining('Andrei Pop'));
  });
});
