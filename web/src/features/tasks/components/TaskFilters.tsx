'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Search, User } from 'lucide-react';
import { t } from '@solar/shared';

import { TaskStatus, TASK_STATUSES, TASK_STATUS_I18N, TASK_STATUS_BADGE } from '../types';
import { Tabs, Button } from '@/components/ui';
import { TabDef } from '../../../types/common';

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
}: TaskFiltersProps) {
  // Build status tabs
  const statusTabs: TabDef[] = [
    {
      key: 'all',
      label: t('task.tab_all'),
      badge: Object.values(statusCounts).reduce((sum, count) => sum + (count || 0), 0),
    },
    ...TASK_STATUSES.map((status) => ({
      key: status,
      label: t(TASK_STATUS_I18N[status]),
      badge: statusCounts[status] || 0,
    })),
  ];

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Search + Only Mine toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('task.search_placeholder')}
            className="hii-input pl-10 pr-8"
            aria-label={t('task.search_placeholder')}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 !w-7 !h-7 !rounded-md text-slate-400 hover:text-slate-600"
              aria-label={t('task.search_clear')}
            >
              ×
            </Button>
          )}
        </div>

        {/* Only Mine toggle */}
        {showOnlyMineFilter && (
          <Button
            variant={onlyMine ? 'primary' : 'secondary'}
            size="md"
            icon={<User className="w-4 h-4" />}
            onClick={() => onOnlyMineChange(!onlyMine)}
            className={clsx(
              'w-full sm:w-auto',
              !onlyMine && 'border-dashed'
            )}
          >
            {t('task.only_mine')}
          </Button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="overflow-x-auto -mx-4 px-4">
        <Tabs
          tabs={statusTabs}
          activeTab={activeStatus}
          onTabChange={onStatusChange}
          className="w-fit min-w-full"
        />
      </div>
    </div>
  );
}
