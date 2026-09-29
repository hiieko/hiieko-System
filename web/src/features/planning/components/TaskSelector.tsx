'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Check, X, ClipboardList, Minus, Trash2 } from 'lucide-react';
import { t, useLocale, type Locale } from '@solar/shared';

// Existing API adapters
import { getTasks } from '@/features/tasks/api';
import type { Task, TaskStatus } from '@/features/tasks/types';
import { TASK_STATUS_BADGE, TASK_STATUS_I18N } from '@/features/tasks/types';

// Existing UI primitives
import { Badge, Button, Card } from '@/components/ui';
import { TaskSelectorSkeleton } from './PlanningSkeleton';

// Planning types
import type { SelectedPlanTask } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────

interface TaskSelectorProps {
  projectId: string;
  selectedTasks: SelectedPlanTask[];
  onSelectionChange: (tasks: SelectedPlanTask[]) => void;
  disabled?: boolean;
}

// ── Helper: is task selectable (not CANCELLED) ───────────────────────────

const isTaskSelectable = (status: TaskStatus): boolean => {
  return status !== 'CANCELLED';
};

// ── Task Item Component (for available tasks list) ────────────────────────

interface TaskItemProps {
  task: Task;
  isSelected: boolean;
  onToggle: () => void;
  locale: Locale;
  disabled: boolean;
}

function TaskItem({ task, isSelected, onToggle, locale, disabled }: TaskItemProps) {
  const selectable = isTaskSelectable(task.status);
  const cannotSelect = !selectable && !isSelected;

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-colors
        ${isSelected
          ? 'bg-hii-50 border-hii-200'
          : cannotSelect
            ? 'bg-slate-50 border-slate-100 opacity-60'
            : 'bg-white border-slate-200 hover:border-slate-300'}
      `}
    >
      {/* Checkbox / indicator */}
      <button
        type="button"
        onClick={cannotSelect ? undefined : onToggle}
        disabled={disabled || cannotSelect}
        aria-pressed={isSelected}
        className={`
          shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
          focus:outline-none focus:ring-2 focus:ring-hii-500 focus:ring-offset-1
          ${isSelected
            ? 'bg-hii-600 border-hii-600 text-white'
            : cannotSelect
              ? 'bg-slate-200 border-slate-300 cursor-not-allowed'
              : 'bg-white border-slate-300 hover:border-slate-400'}
          ${(disabled || cannotSelect) ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {isSelected && <Check className="w-3.5 h-3.5" />}
      </button>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400 shrink-0">
            [{task.code}]
          </span>
          <span className="text-sm font-medium text-slate-900 truncate">
            {task.title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge
            variant={TASK_STATUS_BADGE[task.status] || 'default'}
            size="sm"
          >
            {t(TASK_STATUS_I18N[task.status], locale)}
          </Badge>
          {task.unit_of_measure && (
            <span className="text-xs text-slate-400">
              • {task.unit_of_measure}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Selected Task Item (in selected section with quantity input) ─────────

interface SelectedTaskItemProps {
  selectedTask: SelectedPlanTask;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  disabled: boolean;
  locale: Locale;
}

function SelectedTaskItem({
  selectedTask,
  onUpdateQuantity,
  onRemove,
  disabled,
  locale,
}: SelectedTaskItemProps) {
  const [localValue, setLocalValue] = useState(String(selectedTask.targetQuantity));
  const hasError = selectedTask.targetQuantity < 1;

  useEffect(() => {
    setLocalValue(String(selectedTask.targetQuantity));
  }, [selectedTask.targetQuantity]);

  const handleCommit = () => {
    const num = parseFloat(localValue);
    if (!Number.isNaN(num) && num >= 0) {
      onUpdateQuantity(num);
    } else {
      setLocalValue(String(selectedTask.targetQuantity));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCommit();
    else if (e.key === 'Escape') setLocalValue(String(selectedTask.targetQuantity));
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-hii-50 rounded-lg border border-hii-100">
      <ClipboardList className="w-4 h-4 text-hii-600 shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">[{selectedTask.taskCode}]</span>
          <span className="text-sm font-medium text-slate-900 truncate">{selectedTask.taskTitle}</span>
        </div>
        {selectedTask.unitOfMeasure && (
          <span className="text-xs text-slate-400">{selectedTask.unitOfMeasure}</span>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onUpdateQuantity(Math.max(1, selectedTask.targetQuantity - 1))}
          disabled={disabled || selectedTask.targetQuantity <= 1}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          <Minus className="w-3 h-3 text-slate-500" />
        </button>
        <input
          type="number"
          min={1}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-16 text-center text-sm py-1.5 px-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-hii-500 disabled:opacity-50 ${hasError ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
        />
        <button
          type="button"
          onClick={() => onUpdateQuantity(selectedTask.targetQuantity + 1)}
          disabled={disabled}
          className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          <Check className="w-3 h-3 text-slate-500" style={{ strokeWidth: 3 }} />
        </button>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main TaskSelector Component ───────────────────────────────────────────

export function TaskSelector({
  projectId,
  selectedTasks,
  onSelectionChange,
  disabled = false,
}: TaskSelectorProps) {
  const { locale } = useLocale();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Lookup map for selected tasks
  const selectedByTaskId = useMemo(() => {
    const map: Record<string, SelectedPlanTask> = {};
    for (const st of selectedTasks) map[st.taskId] = st;
    return map;
  }, [selectedTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (task) => task.code.toLowerCase().includes(q) || task.title.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  // Load tasks
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTasks(projectId);
      if (res.error) {
        setError(res.error || t('planning.load_error', locale));
        setTasks([]);
      } else {
        setTasks(res.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('planning.load_error', locale));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, locale]);

  useEffect(() => {
    if (!projectId) { setTasks([]); setLoading(false); return; }
    loadTasks();
  }, [projectId, loadTasks]);

  // Toggle task selection
  const toggleTask = useCallback(
    (task: Task) => {
      const isSelected = !!selectedByTaskId[task.id];
      if (isSelected) {
        onSelectionChange(selectedTasks.filter((st) => st.taskId !== task.id));
      } else {
        const newTask: SelectedPlanTask = {
          taskId: task.id,
          taskTitle: task.title,
          taskCode: task.code,
          targetQuantity: 1,
          unitOfMeasure: task.unit_of_measure || null,
        };
        onSelectionChange([...selectedTasks, newTask]);
      }
    },
    [selectedByTaskId, selectedTasks, onSelectionChange]
  );

  // Update quantity
  const updateQuantity = useCallback(
    (taskId: string, qty: number) => {
      onSelectionChange(
        selectedTasks.map((st) => (st.taskId === taskId ? { ...st, targetQuantity: qty } : st))
      );
    },
    [selectedTasks, onSelectionChange]
  );

  // Clear all
  const clearAll = useCallback(() => onSelectionChange([]), [onSelectionChange]);

  // Validation
  const hasInvalid = selectedTasks.some((st) => st.targetQuantity < 1);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Selected tasks */}
      {selectedTasks.length > 0 && (
        <Card className="p-3 border-hii-200 bg-hii-50/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-hii-700 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              {t('planning.selected', locale).replace('{count}', String(selectedTasks.length))}
              {hasInvalid && (
                <span className="text-red-500 font-normal normal-case">
                  • {t('planning.target_min_error', locale)}
                </span>
              )}
            </h4>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              {t('planning.clear_selected', locale)}
            </button>
          </div>
          <div className="space-y-2">
            {selectedTasks.map((st) => (
              <SelectedTaskItem
                key={st.taskId}
                selectedTask={st}
                onUpdateQuantity={(qty) => updateQuantity(st.taskId, qty)}
                onRemove={() => toggleTask(tasks.find((t) => t.id === st.taskId)!)}
                disabled={disabled}
                locale={locale}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder={t('planning.search_placeholder', locale)}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled || loading}
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-hii-500 focus:outline-none disabled:opacity-50"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && <TaskSelectorSkeleton count={6} />}

      {/* Error */}
      {!loading && error && (
        <div className="p-6 text-center bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadTasks} disabled={disabled}>
            {t('planning.retry', locale)}
          </Button>
        </div>
      )}

      {/* Empty - no tasks at all */}
      {!loading && !error && tasks.length === 0 && (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-600 mb-1">
            {t('planning.empty_tasks_title', locale)}
          </h4>
          <p className="text-xs text-slate-400">
            {t('planning.empty_tasks_message', locale)}
          </p>
        </div>
      )}

      {/* Empty - no search results */}
      {!loading && !error && tasks.length > 0 && filteredTasks.length === 0 && (
        <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-lg">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {t('planning.no_search_results', locale)}
          </p>
        </div>
      )}

      {/* Task list */}
      {!loading && !error && filteredTasks.length > 0 && (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={!!selectedByTaskId[task.id]}
              onToggle={() => toggleTask(task)}
              locale={locale}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
