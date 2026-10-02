'use client';

import React from 'react';
import { Skeleton, Card } from '@/components/ui';

/**
 * Skeleton for a single PlanCard
 */
export function PlanCardSkeleton() {
  return (
    <Card className="p-4 border border-chrome-line rounded-xl bg-surface">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Status badge row */}
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="w-16 h-5 rounded-full" variant="rectangular" />
            <Skeleton className="w-8 h-5 rounded-full" variant="rectangular" />
          </div>

          {/* Date */}
          <Skeleton className="w-32 h-5 mb-1" />

          {/* Team / Notes */}
          <Skeleton className="w-48 h-4 mb-1" />
          <Skeleton className="w-64 h-4" />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Skeleton className="w-9 h-9 rounded-lg" variant="rectangular" />
          <Skeleton className="w-24 h-9 rounded-lg" variant="rectangular" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Planning page skeleton with multiple plan cards
 */
export function PlanningSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PlanCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for TaskSelector when loading tasks
 */
export function TaskSelectorSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-chrome-line"
        >
          <Skeleton className="w-4 h-4 rounded" variant="rectangular" />
          <div className="flex-1 min-w-0">
            <Skeleton className="w-40 h-4 mb-1" />
            <Skeleton className="w-24 h-3" />
          </div>
          <Skeleton className="w-16 h-8 rounded-lg" variant="rectangular" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for task rows inside expanded plan
 */
export function PlanTaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg">
      <Skeleton className="w-5 h-5 rounded-full" variant="circular" />
      <div className="flex-1 min-w-0">
        <Skeleton className="w-48 h-4 mb-1" />
        <Skeleton className="w-32 h-3" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-16 h-8 rounded-lg" variant="rectangular" />
        <span className="text-content-muted">/</span>
        <Skeleton className="w-16 h-8 rounded-lg" variant="rectangular" />
      </div>
    </div>
  );
}
