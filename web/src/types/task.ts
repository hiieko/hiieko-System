/**
 * HIIEKO — Task types (legacy barrel entry)
 *
 * Forwards to the canonical task feature types in `features/tasks/types.ts`,
 * which mirror the Prisma Task model and the real TaskStatusEnum:
 * PLANNED, READY, IN_PROGRESS, BLOCKED, COMPLETED, VERIFIED, CANCELLED.
 *
 * Retained for backwards compatibility with existing `@/types/task` imports.
 */

export * from '../features/tasks/types';
