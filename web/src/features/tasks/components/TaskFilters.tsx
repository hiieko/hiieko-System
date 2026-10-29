'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Search, User } from 'lucide-react';
import { t, useLocale } from '@solar/shared';

import {
  TaskStatus,
  TASK_STATUSES,
  TASK_STATUS_DOT,
  TASK_STATUS_I18N,
} from '../types';
import { Tabs, Button } from '@/components/ui';
import { TabDef } from '../../../types/common';

function statusTabIcon(status: TaskStatus) {
  return function StatusTabIcon() {
    return (
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${TASK_STATUS_DOT[status]}`}
      />
    );
  };
}

interface TaskFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeStatus: string;
  onStatusChange: (status: string) => void;
  onlyMine: boolean;
  onOnlyMineChange: (value: boolean) => void;
  statusCounts: Partial<Record<TaskStatus, number>>;
  className?: string;
  showOnlyMineFilter?: boolean;
  compactToolbar?: boolean;
}

export function TaskFilters({
  searchQuery,
  onSearchChange,
  activeStatus,
  onStatusChange,
  onlyMine,
  onOnlyMineChange,
  statusCounts,
  className,
  showOnlyMineFilter = true,
  compactToolbar = false,
}: TaskFiltersProps) {
  const { locale } = useLocale();

  // Build status tabs
  const statusTabs: TabDef[] = [
    {
      key: 'all',
      label: t('task.tab_all', locale),
      badge: Object.values(statusCounts).reduce((sum, count) => sum + (count || 0), 0),
    },
    ...TASK_STATUSES.map((status) => ({
      key: status,
      label: t(TASK_STATUS_I18N[status], locale),
      icon: statusTabIcon(status),
      badge: statusCounts[status] || 0,
    })),
  ];

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('task.search_placeholder', locale)}
        className="hii-input h-9 pl-10 pr-8"
        aria-label={t('task.search_placeholder', locale)}
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSearchChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 !w-7 !h-7 !rounded-md text-slate-400 hover:text-slate-600"
          aria-label={t('task.search_clear', locale)}
        >
          Ã—
        </Button>
      )}
    </div>
  );

  const onlyMineButton = showOnlyMineFilter ? (
    <Button
      variant={onlyMine ? 'primary' : 'secondary'}
      size="md"
      icon={<User className="w-4 h-4" />}
      onClick={() => onOnlyMineChange(!onlyMine)}
      className={clsx('w-full sm:w-auto xl:justify-self-end', !onlyMine && 'border-dashed')}
    >
      {t('task.only_mine', locale)}
    </Button>
  ) : null;

  const statusTabsView = (
    <div
      data-testid="task-status-tabs"
      className={clsx(
        'min-w-0 overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:mx-0 xl:px-0',
        compactToolbar && 'md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1',
      )}
    >
      <Tabs
        tabs={statusTabs}
        activeTab={activeStatus}
        onTabChange={onStatusChange}
        className={clsx(
          'w-fit min-w-full [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:py-2',
          compactToolbar && 'xl:[&>button]:px-3',
        )}
      />
    </div>
  );

  if (compactToolbar) {
    return (
      <div
        data-testid="tasks-filter-row"
        className={clsx(
          'grid min-w-0 grid-cols-1 items-center gap-x-3 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[17.5rem_minmax(0,1fr)_auto]',
          className,
        )}
      >
        {searchField}
        {statusTabsView}
        {onlyMineButton && (
          <div className="min-w-0 md:col-start-2 md:row-start-1 xl:col-start-3 xl:row-start-1">
            {onlyMineButton}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Search + Only Mine toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {searchField}
        {/* Only Mine toggle */}
        {onlyMineButton}
      </div>

      {/* Status Tabs */}
      {statusTabsView}
    </div>
  );
}
