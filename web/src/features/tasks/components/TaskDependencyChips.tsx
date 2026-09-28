'use client';

import React from 'react';
import { clsx } from 'clsx';
import { t } from '@solar/shared';

import { TaskDependencyRel } from '../types';
import { Badge } from '@/components/ui';

interface TaskDependencyChipsProps {
  prerequisites?: TaskDependencyRel[];
  dependents?: TaskDependencyRel[];
  className?: string;
}

export function TaskDependencyChips({
  prerequisites = [],
  dependents = [],
  className,
}: TaskDependencyChipsProps) {
  const hasPrerequisites = prerequisites.length > 0;
  const hasDependents = dependents.length > 0;

  if (!hasPrerequisites && !hasDependents) {
    return null;
  }

  return (
    <div className={clsx('space-y-2', className)}>
      {/* Prerequisites / Depends on */}
      {hasPrerequisites && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="text-sm font-medium text-slate-500 shrink-0 pt-1">
            {t('task.depends_on')}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {prerequisites.map((dep) => {
              const predecessor = dep.predecessor;
              if (!predecessor) return null;

              return (
                <Badge
                  key={dep.id}
                  variant="info"
                  size="sm"
                  className="flex-shrink-0"
                >
                  <span className="font-mono">{predecessor.code}</span>
                  <span className="text-slate-500 ml-1">—</span>
                  <span className="ml-1">{predecessor.title}</span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Dependents / Blocks */}
      {hasDependents && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="text-sm font-medium text-slate-500 shrink-0 pt-1">
            {t('task.blocks')}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {dependents.map((dep) => {
              const successor = dep.successor;
              if (!successor) return null;

              return (
                <Badge
                  key={dep.id}
                  variant="warning"
                  size="sm"
                  className="flex-shrink-0"
                >
                  <span className="font-mono">{successor.code}</span>
                  <span className="text-slate-500 ml-1">—</span>
                  <span className="ml-1">{successor.title}</span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
