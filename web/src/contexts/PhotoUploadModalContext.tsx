'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { t, useLocale } from '@solar/shared';
import { Modal } from '../components/ui/Modal';
import { PhotoUpload, type PhotoTargetType } from '../components/ui/PhotoUpload';

export interface PhotoUploadTarget {
  targetType: PhotoTargetType;
  targetId: string;
  projectId: string;
}

interface PhotoUploadModalContextValue {
  /** Whether the global photo modal is open. */
  open: boolean;
  /** Current modal target (null while closed). */
  targetType: PhotoTargetType | null;
  targetId: string | null;
  projectId: string | null;
  openPhotoUpload: (target: PhotoUploadTarget) => void;
  closePhotoUpload: () => void;
}

const PhotoUploadModalContext = createContext<PhotoUploadModalContextValue | null>(null);

/**
 * Global photo-upload modal. Any page can open it through `usePhotoUploadModal`,
 * so photo attachments are no longer rendered inline. The provider renders the
 * single modal instance (wrapping the existing PhotoUpload) and must live inside
 * ToastProvider so uploads/removals can surface toasts.
 */
export function PhotoUploadModalProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const [target, setTarget] = useState<PhotoUploadTarget | null>(null);

  const openPhotoUpload = useCallback((next: PhotoUploadTarget) => setTarget(next), []);
  const closePhotoUpload = useCallback(() => setTarget(null), []);

  const value = useMemo<PhotoUploadModalContextValue>(
    () => ({
      open: !!target,
      targetType: target?.targetType ?? null,
      targetId: target?.targetId ?? null,
      projectId: target?.projectId ?? null,
      openPhotoUpload,
      closePhotoUpload,
    }),
    [target, openPhotoUpload, closePhotoUpload],
  );

  return (
    <PhotoUploadModalContext.Provider value={value}>
      {children}
      <Modal
        open={!!target}
        onClose={closePhotoUpload}
        title={t('photo_upload.title', locale)}
        size="lg"
      >
        {target && (
          <PhotoUpload
            targetType={target.targetType}
            targetId={target.targetId}
            projectId={target.projectId}
          />
        )}
      </Modal>
    </PhotoUploadModalContext.Provider>
  );
}

export function usePhotoUploadModal() {
  const ctx = useContext(PhotoUploadModalContext);
  if (!ctx) throw new Error('PhotoUploadModalProvider missing');
  return ctx;
}
