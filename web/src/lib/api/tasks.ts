/**
 * HIIEKO — Tasks API module (legacy barrel entry)
 *
 * Forwards to the canonical feature adapter in `features/tasks/api.ts`,
 * which is verified against the real NestJS TasksController and
 * TaskDependenciesController:
 *
 *   GET   /api/tasks                              list (optional projectId)
 *   GET   /api/tasks/:id                          single task
 *   POST  /api/tasks                              create
 *   PATCH /api/tasks/:id                          update status / quantities
 *   POST  /api/tasks/:id/assign                   assign user
 *   POST  /api/task-dependencies                  link tasks
 *   GET   /api/task-dependencies/check-prerequisites/:taskId
 *
 * NOTE: DELETE functions were removed — there is no DELETE endpoint on
 * TasksController or TaskDependenciesController.
 *
 * Retained for backwards compatibility with existing `@/lib/api` imports.
 */

export * from '../../features/tasks/api';
