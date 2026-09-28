'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { t } from '@solar/shared';

import { TaskStatus } from '../types';
import { Button, LoadingSpinner } from '@/components/ui';

interface TaskQuantityEditorProps {
  currentStatus: TaskStatus;
  plannedQuantity?: number | string | null;
  actualQuantity?: number | string | null;
  unitOfMeasure?: string | null;
  onSave: (quantity: number) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export function TaskQuantityEditor({
  currentStatus,
  plannedQuantity,
  actualQuantity,
  unitOfMeasure,
  onSave,
  disabled = false,
  className,
}: TaskQuantityEditorProps) {
  // Parse initial values
  const planned = plannedQuantity != null ? Number(plannedQuantity) : null;
  const initialActual = actualQuantity != null ? Number(actualQuantity) : 0;

  // Local state
  const [value, setValue] = useState<string>(String(initialActual));
  const [isSaving, setIsSaving] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update local value when prop changes (but not during edit)
  useEffect(() => {
    if (!hasFocus) {
      const current = actualQuantity != null ? Number(actualQuantity) : 0;
      setValue(String(current));
    }
  }, [actualQuantity, hasFocus]);

  // Is the task in a terminal state?
  const isTerminal = currentStatus === 'VERIFIED' || currentStatus === 'CANCELLED';
  const isDisabled = disabled || isSaving || isTerminal;

  // Parse current value as number
  const parsedValue = parseFloat(value);
  const isValidNumber = !isNaN(parsedValue) && isFinite(parsedValue) && parsedValue >= 0;

  // Check if value actually changed from prop
  const hasChanged = () => {
    if (!isValidNumber) return false;
    const propActual = actualQuantity != null ? Number(actualQuantity) : 0;
    return Math.abs(parsedValue - propActual) > 0.001;
  };

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isValidNumber || !hasChanged() || isDisabled) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(parsedValue);
      // Value will be updated via prop after successful save
    } catch (err) {
      // Revert to prop value on error
      const propActual = actualQuantity != null ? Number(actualQuantity) : 0;
      setValue(String(propActual));
    } finally {
      setIsSaving(false);
    }
  }, [isValidNumber, parsedValue, isDisabled, onSave, actualQuantity]);

  // Key handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // Revert to prop value
      const propActual = actualQuantity != null ? Number(actualQuantity) : 0;
      setValue(String(propActual));
      inputRef.current?.blur();
    }
  };

  // Focus handlers
  const handleFocus = () => setHasFocus(true);
  const handleBlur = () => {
    setHasFocus(false);
    handleSave();
  };

  // Format number for display
  const formatNumber = (num: number) => {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    return num.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <div className={clsx('space-y-2', className)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">
          {t('task.actual_quantity')}
          {unitOfMeasure && (
            <span className="text-slate-400 ml-1">({unitOfMeasure})</span>
          )}
        </span>
        {planned != null && (
          <span className="text-xs text-slate-400">
            {t('task.planned')}: {formatNumber(planned)} {unitOfMeasure || ''}
          </span>
        )}
      </div>

      {/* Input and save */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={isDisabled}
          className={clsx(
            'flex-1 px-3 py-2 text-sm border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-hii-500 focus:border-hii-500',
            'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
            !isValidNumber && value.length > 0 && 'border-red-300 bg-red-50'
          )}
          aria-label={t('task.actual_quantity')}
          placeholder="0"
        />

        {hasChanged() && isValidNumber && !isDisabled && (
          <Button
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            disabled={!isValidNumber}
          >
            {t('general.save')}
          </Button>
        )}
      </div>

      {/* Hint */}
      {!isTerminal && (
        <p className="text-xs text-slate-400">
          {t('task.quantity_save_hint')}
        </p>
      )}

      {/* Terminal state message */}
      {isTerminal && (
        <p className="text-xs text-slate-400 italic">
          {t('task.final_status')}
        </p>
      )}
    </div>
  );
}
