'use client';

import React from 'react';
import { Badge } from '@/components/ui';
import { t, useLocale } from '@solar/shared';
import {
  DailyPlanStatus,
  PLAN_STATUS_BADGE,
  PLAN_STATUS_I18N,
} from '../types';

interface PlanStatusBadgeProps {
  status: DailyPlanStatus;
  size?: 'sm' | 'md';
}

export function PlanStatusBadge({ status, size = 'sm' }: PlanStatusBadgeProps) {
  const { locale } = useLocale();
  const variant = PLAN_STATUS_BADGE[status];
  const label = t(PLAN_STATUS_I18N[status], locale);

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
}
