'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { t, useLocale } from '@solar/shared';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * v0 design port (Step 2 — UI primitives): reusable side/bottom drawer.
 *
 * Reuses the production Modal architecture (focus trap, Escape capture, body
 * scroll lock) with the v0 drawer treatment (edge-anchored panel + backdrop)
 * expressed in production tokens:
 *   - z-drawer (60) for the panel, backdrop at z-backdrop (50) inside the same
 *     fixed wrapper — below Modal (70), above the mobile primary nav (30).
 *   - `chrome-*` / `surface-*` CSS-variable tokens, no raw slate colors.
 * Does NOT replace Modal/ConfirmDialog; it is an additional primitive.
 */

export type DrawerSide = 'right' | 'bottom';
type DrawerSize = 'sm' | 'md' | 'lg';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Edge the panel is anchored to. Default 'right'. */
  side?: DrawerSide;
  /** sm = max-w-sm / max-h-1/3, md = max-w-lg / max-h-1/2, lg = max-w-2xl / max-h-2/3 */
  size?: DrawerSize;
  showClose?: boolean;
  className?: string;
  /** Bottom drawers only: close when dragged down past a threshold. */
  swipeToClose?: boolean;
}

const sideStyles: Record<DrawerSide, Record<DrawerSize, string>> = {
  right: {
    sm: 'w-screen max-w-sm',
    md: 'w-screen max-w-lg',
    lg: 'w-screen max-w-2xl',
  },
  bottom: {
    sm: 'max-h-[33vh]',
    md: 'max-h-[50vh]',
    lg: 'max-h-[66vh]',
  },
};

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  size = 'lg',
  showClose = true,
  className,
  swipeToClose = false,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { locale } = useLocale();

  useFocusTrap(dialogRef, open);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!swipeToClose || side !== 'bottom') return;
      touchStartY.current = e.touches[0].clientY;
      setDragging(true);
    },
    [swipeToClose, side],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const scroller = contentRef.current;
    if (scroller && scroller.scrollTop > 0) {
      touchStartY.current = null;
      setDragY(0);
      return;
    }
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragY(delta);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartY.current == null) return;
    const shouldClose = dragY > 80;
    touchStartY.current = null;
    setDragY(0);
    setDragging(false);
    if (shouldClose) onClose();
  }, [dragY, onClose]);

  // Close on Escape (capture phase, same pattern as production Modal).
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown, { capture: true });
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const isRight = side === 'right';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden" role="presentation">
      {/* Backdrop (z-backdrop layer, below the panel) */}
      <div
        className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 200ms ease-out',
        }}
        className={clsx(
          'absolute z-[60] bg-surface shadow-2xl border-chrome-line flex flex-col',
          'animate-in fade-in duration-200',
          isRight
            ? clsx(
                'inset-y-0 right-0 border-l rounded-l-2xl',
                'animate-in slide-in-from-right duration-300',
                sideStyles.right[size],
              )
            : clsx(
                'inset-x-0 bottom-0 border-t rounded-t-2xl',
                'animate-in slide-in-from-bottom duration-300',
                'pb-[max(env(safe-area-inset-bottom),0.5rem)]',
                sideStyles.bottom[size],
              ),
          className,
        )}
      >
        {(title || showClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-chrome-line">
            {title && <h2 className="text-lg font-semibold text-content">{title}</h2>}
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-muted text-content-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={t('a11y.close_drawer', locale)}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export default Drawer;
