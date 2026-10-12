'use client';
import React from 'react';
import { t, useLocale } from '@solar/shared';
import { Camera } from 'lucide-react';
import { PhotoUpload } from '../../components/ui';

interface Props {
  /** Undefined until the report has been saved as a draft at least once. */
  reportId?: string;
  projectId: string;
  readOnly?: boolean;
}

/**
 * P5 — Photos section of the daily report form. Photos attach to the persisted
 * report (`daily_report` target), so the section only becomes interactive once a
 * draft id exists. The section itself is not part of the report DTO; attachments
 * are stored out-of-band through /api/attachments.
 */
export function DailyReportPhotosSection({ reportId, projectId, readOnly }: Props) {
  const { locale } = useLocale();

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Camera className="w-4 h-4" />
        {t('daily_report.section_photos', locale)}
      </h3>

      {reportId ? (
        <PhotoUpload
          targetType="daily_report"
          targetId={reportId}
          projectId={projectId}
          readOnly={readOnly}
        />
      ) : (
        <p className="text-sm text-slate-500">{t('daily_report.photos_save_first', locale)}</p>
      )}
    </div>
  );
}
