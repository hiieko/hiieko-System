'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';
import { RoleGuard } from '../../../lib/auth-guard';
import { DailyReportForm } from '../../../features/daily-reports';

function FormPageInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') || undefined;
  return <DailyReportForm reportId={editId} />;
}

export default function RapoarteFormPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'owner', 'manager', 'pm', 'site_manager', 'foreman', 'team_leader', 'technician']}>
      <div className="px-4 py-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <FormPageInner />
      </div>
    </RoleGuard>
  );
}
