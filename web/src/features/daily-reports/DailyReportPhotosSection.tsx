'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { t, useLocale } from '@solar/shared';
import { Camera, ImagePlus } from 'lucide-react';
import { Button, PhotoUpload } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

interface Props {
  /** Undefined until the report has been saved as a draft at least once. */
  reportId?: string;
  projectId: string;
  readOnly?: boolean;
  /**
   * Persists the current draft and resolves with the saved report id,
   * or `undefined` when the save failed. Photos need a persisted report id.
   */
  onSaveDraft?: () => Promise<string | undefined>;
}

/**
 * P5 — Photos section of the daily report form.
 *
 * The section renders the reusable PhotoUpload gallery inline, so photos already
 * attached to the report stay visible after they are uploaded (the earlier
 * global-modal-only flow hid them again as soon as the modal closed). Photos
 * attach to the persisted report (`daily_report` target), so when the report has
 * no id yet the section first auto-saves a draft and renders the gallery on the
 * freshly-created report.
 */
export function DailyReportPhotosSection({ reportId, projectId, readOnly, onSaveDraft }: Props) {
  const { locale } = useLocale();
  const toast = useToast();

  const [savingDraft, setSavingDraft] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [localReportId, setLocalReportId] = useState<string | undefined>(reportId);

  useEffect(() => { setLocalReportId(reportId); }, [reportId]);

  const effectiveReportId = localReportId || reportId;

  const handleAddClick = useCallback(async () => {
    if (!onSaveDraft) return;
    setSavingDraft(true);
    setSaveFailed(false);
    const id = await onSaveDraft();
    setSavingDraft(false);
    if (!id) {
      setSaveFailed(true);
      toast.error('Could not save draft before attaching photo. Try saving manually.');
      return;
    }
    setLocalReportId(id);
  }, [onSaveDraft, toast]);

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Camera className="w-4 h-4" />
        {t('daily_report.section_photos', locale)}
      </h3>

      {effectiveReportId ? (
        <PhotoUpload
          targetType="daily_report"
          targetId={effectiveReportId}
          projectId={projectId}
          readOnly={readOnly}
        />
      ) : savingDraft ? (
        <p className="text-sm text-slate-500">Saving draft...</p>
      ) : saveFailed ? (
        <p className="text-sm text-slate-500">{t('daily_report.photos_save_first', locale)}</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleAddClick()}
          icon={<ImagePlus className="w-4 h-4" />}
        >
          {t('photo_upload.add', locale)}
        </Button>
      )}
    </div>
  );
}
