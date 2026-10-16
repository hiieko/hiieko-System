'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
 * P5 — Photos section of the daily report form. Photos attach to the persisted
 * report (`daily_report` target), so the section only becomes interactive once a
 * draft id exists.
 *
 * When the report has no id yet, clicking "Add photo" auto-saves the draft first,
 * then opens the photo picker on the freshly-created report. A submitted report
 * (readOnly) keeps the plain hint — its photos can no longer be changed.
 */
export function DailyReportPhotosSection({ reportId, projectId, readOnly, onSaveDraft }: Props) {
  const { locale } = useLocale();
  const toast = useToast();

  const [savingDraft, setSavingDraft] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [localReportId, setLocalReportId] = useState<string | undefined>(reportId);
  const [pendingOpen, setPendingOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalReportId(reportId); }, [reportId]);

  const effectiveReportId = localReportId || reportId;

  // Once the auto-save created the draft, PhotoUpload mounts with a target id.
  // Open its picker right away so the original click still ends in a file selection.
  useEffect(() => {
    if (!pendingOpen || !effectiveReportId) return;
    const input = containerRef.current?.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) input.click();
    setPendingOpen(false);
  }, [pendingOpen, effectiveReportId]);

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
    setPendingOpen(true);
  }, [onSaveDraft, toast]);

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <Camera className="w-4 h-4" />
        {t('daily_report.section_photos', locale)}
      </h3>

      <div ref={containerRef}>
        {effectiveReportId ? (
          <PhotoUpload
            targetType="daily_report"
            targetId={effectiveReportId}
            projectId={projectId}
            readOnly={readOnly}
          />
        ) : readOnly ? (
          <p className="text-sm text-slate-500">{t('daily_report.photos_save_first', locale)}</p>
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
    </div>
  );
}
