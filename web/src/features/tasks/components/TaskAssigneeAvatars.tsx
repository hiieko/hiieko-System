'use client';

import React, { useState } from 'react';
import { t } from '@solar/shared';

import type { TaskAssignment } from '../types';

export function getTaskAssigneeName(assignment: TaskAssignment): string | null {
  const fullName = assignment.user?.profile?.full_name?.trim() || assignment.user?.fullName?.trim();
  return fullName || assignment.user?.email?.trim() || null;
}

export function getTaskAssigneeInitials(name: string): string {
  const source = name.includes('@') ? name.split('@')[0].replace(/[._-]+/g, ' ') : name;
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase();
}

const AVATAR_TONES = [
  'bg-hii-100 text-hii-800',
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-900',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
];

function avatarTone(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

interface TaskAssigneeAvatarsProps {
  assignments?: TaskAssignment[];
  locale: 'ro' | 'en';
  maxVisible?: number;
  showName?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

function AssigneeAvatar({
  assignment,
  name,
  sizeClass,
}: {
  assignment: TaskAssignment;
  name: string;
  sizeClass: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = assignment.user?.profile?.avatar_url?.trim();
  const showImage = Boolean(avatarUrl) && !imageFailed;

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white font-semibold ${sizeClass} ${avatarTone(
        assignment.user_id || name,
      )}`}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{getTaskAssigneeInitials(name)}</span>
      )}
    </span>
  );
}

/** Names, initials and images are derived only from the task's real assignment/user relations. */
export function TaskAssigneeAvatars({
  assignments = [],
  locale,
  maxVisible = 3,
  showName = false,
  size = 'sm',
  className = '',
}: TaskAssigneeAvatarsProps) {
  const people = assignments
    .map((assignment) => ({ assignment, name: getTaskAssigneeName(assignment) }))
    .filter(
      (person): person is { assignment: TaskAssignment; name: string } => person.name !== null,
    );

  if (people.length === 0) return null;

  const visible = people.slice(0, maxVisible);
  const overflowCount = people.length - visible.length;
  const peopleLabel = t('task.assignees', locale);
  const names = people.map((person) => person.name);
  const avatarSize = size === 'md' ? 'h-7 w-7 text-[9px]' : 'h-5 w-5 text-[8px]';

  return (
    <span
      role="group"
      aria-label={`${peopleLabel}: ${names.join(', ')}`}
      title={names.join(', ')}
      className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}
    >
      <span className="flex shrink-0 -space-x-1.5">
        {visible.map(({ assignment, name }) => (
          <AssigneeAvatar
            key={assignment.id}
            assignment={assignment}
            name={name}
            sizeClass={avatarSize}
          />
        ))}
        {overflowCount > 0 && (
          <span
            aria-hidden="true"
            className={`grid shrink-0 place-items-center rounded-full border-2 border-white bg-slate-100 font-semibold text-content-secondary ${avatarSize}`}
          >
            +{overflowCount}
          </span>
        )}
      </span>
      {showName && (
        <span aria-hidden="true" className="min-w-0 truncate text-xs text-content-secondary">
          {names[0]}
          {people.length > 1 ? ` +${people.length - 1}` : ''}
        </span>
      )}
    </span>
  );
}
