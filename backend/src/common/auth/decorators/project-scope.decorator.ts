// ============================================================================
// @ProjectScope() param decorator (GAP 4)
// ============================================================================
// Injects the user's authorization scope into a controller method parameter.
// The scope is populated by ProjectAccessGuard when the route is decorated
// with @RequireProjectAccess(param, 'optional').
//
// Usage:
//   @Get()
//   @RequireProjectAccess('projectId', 'optional')
//   async findAll(@ProjectScope() scope: ProjectScope, @Query('projectId') projectId?: string) {
//     const where = buildScopedProjectWhere(scope, projectId);
//     return this.service.findAll(where);
//   }
// ============================================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ProjectScope as ProjectScopeType } from '../project-scope.filter';

export const ProjectScope: () => ParameterDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectScopeType => {
    const request = ctx.switchToHttp().getRequest();
    return request.projectScope ?? { isGlobal: true, projectIds: [] };
  },
);
