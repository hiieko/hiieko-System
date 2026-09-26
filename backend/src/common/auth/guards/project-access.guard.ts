import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleEnum } from '@prisma/client';
import {
  REQUIRE_PROJECT_ACCESS_KEY,
  REQUIRE_PROJECT_PARAMS_KEY,
  REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
  RequireEntityProjectAccessMetadata,
  RequireProjectAccessMetadata,
  ScopedEntityModel,
} from '../decorators/auth-metadata.decorator';
import { AuthenticatedUser } from '../auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { isGlobalProjectScopeRole } from '../project-scope';

/**
 * Prisma delegate map for entity-derived project_id resolution.
 * Each key is a ScopedEntityModel; the value is the Prisma delegate and
 * the field name to select for the project_id.
 */
const ENTITY_RESOLVER: Record<
  ScopedEntityModel,
  { delegate: string; projectField: string; nestedInclude?: boolean }
> = {
  task: { delegate: 'task', projectField: 'project_id' },
  dailyPlan: { delegate: 'dailyPlan', projectField: 'project_id' },
  dailyPlanTask: { delegate: 'dailyPlanTask', projectField: 'project_id', nestedInclude: true },
  dailyReport: { delegate: 'dailyReport', projectField: 'project_id' },
  team: { delegate: 'team', projectField: 'project_id' },
  document: { delegate: 'document', projectField: 'project_id' },
  expense: { delegate: 'expense', projectField: 'project_id' },
  changeOrder: { delegate: 'changeOrder', projectField: 'project_id' },
  inspection: { delegate: 'inspection', projectField: 'project_id' },
  issue: { delegate: 'issue', projectField: 'project_id' },
  ocrJob: { delegate: 'oCRJob', projectField: 'project_id', nestedInclude: true },
  purchaseOrder: { delegate: 'purchaseOrder', projectField: 'project_id' },
  aviz: { delegate: 'aviz', projectField: 'project_id' },
};

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    // ── 0. Unauthenticated → 401 (defense-in-depth) ─────────────────────
    if (!user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // ── 1. Multi-param project access (GAP 1: sourceProjectId + targetProjectId) ─
    const multiParams = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PROJECT_PARAMS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (Array.isArray(multiParams) && multiParams.length > 0) {
      const presentParams: string[] = [];
      for (const p of multiParams) {
        const val = this.extractParam(request, p);
        if (val) {
          presentParams.push(val);
        }
      }
      // No present params → nothing to check → allow (service validates elsewhere)
      if (presentParams.length > 0) {
        for (const projectId of presentParams) {
          await this.checkProjectAccess(user, projectId);
        }
      }
      return true;
    }

    // ── 2. Direct projectId param ──────────────────────────────────────
    const meta = this.reflector.getAllAndOverride<RequireProjectAccessMetadata | string>(
      REQUIRE_PROJECT_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (meta) {
      // Backward compatibility: if stored as a plain string, treat as required
      const paramName: string = typeof meta === 'string' ? meta : meta.param;
      const mode: 'required' | 'optional' =
        typeof meta === 'string' ? 'required' : meta.mode;

      const projectId = this.extractParam(request, paramName);

      if (mode === 'required') {
        if (!projectId) {
          throw new ForbiddenException(
            `Required project parameter "${paramName}" is missing from the request`,
          );
        }
        return this.checkProjectAccess(user, projectId);
      }

      // mode === 'optional'
      if (projectId) {
        return this.checkProjectAccess(user, projectId);
      }

      // No projectId provided — populate scope and allow
      this.attachProjectScope(request, user);
      return true;
    }

    // ── 3. Entity-derived projectId ────────────────────────────────────
    const entityMeta = this.reflector.getAllAndOverride<RequireEntityProjectAccessMetadata>(
      REQUIRE_ENTITY_PROJECT_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (entityMeta) {
      const paramNames = Array.isArray(entityMeta.param) ? entityMeta.param : [entityMeta.param];
      let anyChecked = false;
      for (const paramName of paramNames) {
        const entityId = this.extractParam(request, paramName);
        if (!entityId) continue; // skip absent params
        anyChecked = true;
        const projectId = await this.resolveEntityProjectId(entityMeta.model, entityId);
        if (projectId === null) {
          throw new NotFoundException(
            `${entityMeta.model} with id "${entityId}" not found`,
          );
        }
        await this.checkProjectAccess(user, projectId);
      }
      if (!anyChecked) {
        throw new ForbiddenException(
          `Required entity parameter(s) "${entityMeta.param}" missing from the request`,
        );
      }
      return true;
    }

    // ── 4. No project-scoped metadata → allow (global/non-scoped route) ──
    return true;
  }

  /**
   * Core membership check. Returns true (allows) or throws.
   */
  private async checkProjectAccess(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<boolean> {
    // 1. Global-scope role bypass
    if (isGlobalProjectScopeRole(user.role)) {
      return true;
    }

    // 2. In-memory fast path (populated by JwtAuthGuard)
    if (user.projectRoles && user.projectRoles[projectId]) {
      return true;
    }

    // 3. Database membership check
    const member = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: user.id,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(
        `Access denied. You are not assigned to project ${projectId}`,
      );
    }

    return true;
  }

  /**
   * Extract a named parameter from params, query, or body (in that order).
   */
  private extractParam(request: any, name: string): string | undefined {
    return (
      request.params?.[name] ??
      request.query?.[name] ??
      request.body?.[name] ??
      undefined
    );
  }

  /**
   * Resolve an entity's project_id via Prisma by its ScopedEntityModel.
   * Returns null if the entity does not exist (caller decides 403 vs 404).
   */
  private async resolveEntityProjectId(
    model: ScopedEntityModel,
    entityId: string,
  ): Promise<string | null> {
    const resolver = ENTITY_RESOLVER[model];
    if (!resolver) {
      throw new ForbiddenException(`Unknown entity model: ${model}`);
    }

    const delegate = (this.prisma as any)[resolver.delegate];
    if (!delegate || typeof delegate.findUnique !== 'function') {
      throw new ForbiddenException(`No Prisma delegate for model: ${model}`);
    }

    const select: any = resolver.nestedInclude
      ? model === 'ocrJob'
        ? { document: { select: { project_id: true } } }
        : model === 'dailyPlanTask'
          ? { daily_plan: { select: { project_id: true } } }
          : { [resolver.projectField]: true }
      : { [resolver.projectField]: true };

    const record = await delegate.findUnique({
      where: { id: entityId },
      select,
    });

    if (!record) {
      return null;
    }

    if (resolver.nestedInclude) {
      if (model === 'ocrJob') {
        return record.document?.project_id ?? null;
      }
      return record.daily_plan?.project_id ?? null;
    }

    return record[resolver.projectField] ?? null;
  }

  /**
   * Populate request.projectScope for GAP 4 optional list scoping.
   */
  private attachProjectScope(request: any, user: AuthenticatedUser): void {
    if (isGlobalProjectScopeRole(user.role)) {
      request.projectScope = { isGlobal: true, projectIds: [] };
    } else {
      // Collect from in-memory projectRoles or fetch from DB
      const projectIds = user.projectRoles
        ? Object.keys(user.projectRoles)
        : [];
      request.projectScope = { isGlobal: false, projectIds };
    }
  }
}
