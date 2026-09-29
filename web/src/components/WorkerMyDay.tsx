'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { t, useLocale } from '@solar/shared';
import { useProject } from '../contexts/ProjectContext';
import { apiClient } from '../lib/api-client';
import { getMyPlanTasks, selectMyWorkTasks, todayLocalIso } from '../features/planning';
import type { FieldTaskRow } from '../features/planning';
import { WorkerDayHeader } from './WorkerDayHeader';
import { WorkerAttendanceCard } from './WorkerAttendanceCard';
import { WorkerTodayTasks } from './WorkerTodayTasks';
import { WorkerBlockers } from './WorkerBlockers';
import { WorkerNotifications } from './WorkerNotifications';

interface NotifItem {
  id: string;
  title_ro: string;
  title_en?: string | null;
  message_ro: string;
  message_en?: string | null;
  is_read: boolean;
  priority: string;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export function WorkerMyDay() {
  const { locale } = useLocale();
  const { selectedProject } = useProject();

  // Tasks state — worker/technician source only (GET /api/daily-plans/my-tasks),
  // so the panel no longer depends on the project selector.
  const [tasks, setTasks] = useState<FieldTaskRow[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Issues/blockers state
  const [issues, setIssues] = useState<any[] | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotifItem[] | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  // Load tasks
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await getMyPlanTasks(todayLocalIso());
      setTasks(selectMyWorkTasks(res.data));
    } catch (err: unknown) {
      setTasksError(err instanceof Error ? err.message : t('worker.error_generic', locale));
      setTasks(null);
    } finally {
      setTasksLoading(false);
    }
  }, [locale]);

  // Load issues
  const loadIssues = useCallback(async () => {
    if (!selectedProject) { setIssues(null); return; }
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await apiClient.getIssues({ projectId: selectedProject.id });
      setIssues((res.data || []) as any[]);
    } catch (err: unknown) {
      setIssuesError(err instanceof Error ? err.message : t('worker.error_generic', locale));
      setIssues(null);
    } finally {
      setIssuesLoading(false);
    }
  }, [selectedProject, locale]);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const res = await apiClient.getNotifications({ pageSize: 5, unreadOnly: true });
      // Handle both direct array and paginated envelope { data: array }
      let notifData: any[];
      if (Array.isArray(res.data)) {
        notifData = res.data;
      } else if (res.data && Array.isArray((res.data as any).data)) {
        notifData = (res.data as any).data;
      } else {
        notifData = [];
      }
      setNotifications(notifData as NotifItem[]);
    } catch (err: unknown) {
      setNotificationsError(err instanceof Error ? err.message : t('worker.error_generic', locale));
      setNotifications(null);
    } finally {
      setNotificationsLoading(false);
    }
  }, [locale]);

  // Mark notification as read
  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications(prev => prev ? prev.map(n => n.id === id ? { ...n, is_read: true } : n) : prev);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTasks();
    loadIssues();
    loadNotifications();
  }, [loadTasks, loadIssues, loadNotifications]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
      <WorkerDayHeader />
      <WorkerAttendanceCard />

      <div className="grid grid-cols-1 gap-4">
        <WorkerTodayTasks
          rows={tasks}
          loading={tasksLoading}
          error={tasksError}
          onRetry={loadTasks}
          maxItems={5}
        />
        <WorkerBlockers
          issues={issues}
          loading={issuesLoading}
          error={issuesError}
          onRetry={loadIssues}
          maxItems={3}
        />
      </div>

      <WorkerNotifications
        notifications={notifications}
        loading={notificationsLoading}
        error={notificationsError}
        onRetry={loadNotifications}
        onMarkRead={handleMarkRead}
        maxItems={3}
      />
    </div>
  );
}

