'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { t } from '@solar/shared';
import { User, Loader2 } from 'lucide-react';

import { Modal, Button, EmptyState, Skeleton, Badge } from '@/components/ui';
import { getProjectMembers } from '../../projects/api';
import { assignTask } from '../api';
import { Task, TaskAssignment } from '../types';
import { ProjectMember } from '../../projects/types';

interface TaskAssignModalProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  onAssigned: (updatedTask: Task) => void;
}

export function TaskAssignModal({
  open,
  onClose,
  task,
  onAssigned,
}: TaskAssignModalProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get already assigned user IDs
  const assignedUserIds = new Set(
    (task.assignments || []).map((a) => a.user_id)
  );

  // Fetch project members when modal opens
  useEffect(() => {
    if (!open) return;

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await getProjectMembers(task.project_id);
        if (res.data && !res.error) {
          setMembers(res.data);
        } else {
          setError(res.error || t('task.err_generic'));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t('task.err_generic')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [open, task.project_id]);

  // Filter: only show members NOT already assigned
  const availableMembers = members.filter((m) => !assignedUserIds.has(m.user_id));

  // Get member display name
  const getMemberName = (member: ProjectMember) => {
    if (member.user?.profile?.full_name) {
      return member.user.profile.full_name;
    }
    if (member.user?.fullName) {
      return member.user.fullName;
    }
    return member.user?.email || member.user_id;
  };

  // Handle assign
  const handleAssign = async (userId: string) => {
    setAssigning(userId);
    setError(null);

    try {
      const res = await assignTask(task.id, userId);
      if (res.data && !res.error) {
        // Create updated task with new assignment
        const newAssignment: TaskAssignment = {
          id: res.data.id,
          task_id: res.data.task_id,
          user_id: res.data.user_id,
          assigned_at: res.data.assigned_at,
        };

        const updatedTask: Task = {
          ...task,
          assignments: [...(task.assignments || []), newAssignment],
        };

        onAssigned(updatedTask);
        onClose();
      } else {
        setError(res.error || t('task.err_generic'));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('task.err_generic')
      );
    } finally {
      setAssigning(null);
    }
  };

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setError(null);
      setAssigning(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('task.assign_member')}
      size="md"
    >
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      )}

      {/* No project members */}
      {!loading && members.length === 0 && !error && (
        <EmptyState
          title={t('task.no_project_members')}
          icon={<User className="w-8 h-8 text-slate-400" />}
        />
      )}

      {/* All members assigned */}
      {!loading && members.length > 0 && availableMembers.length === 0 && !error && (
        <EmptyState
          title={t('task.all_members_assigned')}
          icon={<User className="w-8 h-8 text-slate-400" />}
        />
      )}

      {/* Available members list */}
      {!loading && availableMembers.length > 0 && (
        <div className="space-y-2">
          {availableMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => handleAssign(member.user_id)}
              disabled={assigning !== null}
              className={clsx(
                'w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                'hover:bg-slate-50 hover:border-slate-300',
                'focus:outline-none focus:ring-2 focus:ring-hii-500',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {getMemberName(member)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {member.user?.email || ''}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral" size="sm">
                  {member.role}
                </Badge>
                {assigning === member.user_id && (
                  <Loader2 className="w-4 h-4 animate-spin text-hii-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Current assignments note */}
      {task.assignments && task.assignments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {task.assignments.length} {t('task.assigned_count')}
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('task.cancel')}
        </Button>
      </div>
    </Modal>
  );
}
