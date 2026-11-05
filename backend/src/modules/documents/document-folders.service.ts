import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectFolderProtectionPolicyEnum,
  UserRoleEnum,
} from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth.types';
import { isGlobalProjectScopeRole } from '../../common/auth/project-scope';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateDocumentFolderDto,
  RenameDocumentFolderDto,
} from './document-folders.dto';

const FOLDER_MANAGE_PERMISSION = { module: 'documents', action: 'folder_manage' } as const;
const COMPANY_SCOPE_LOCK = '<company>';
type FolderDb = PrismaService | Prisma.TransactionClient;
type FolderTx = Prisma.TransactionClient;

interface FolderScope {
  organizationId: string;
  projectId: string | null;
}

@Injectable()
export class DocumentFoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string | undefined, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const scope = await this.resolveScope(projectId, user, tx);
      const [folders, canManage] = await Promise.all([
        tx.documentFolder.findMany({
        where: {
          organization_id: scope.organizationId,
          project_id: scope.projectId,
        },
        orderBy: [{ parent_id: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        }),
        this.canManage(scope, user, tx),
      ]);
      return { folders, canManage };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async create(projectId: string | undefined, dto: CreateDocumentFolderDto, user: AuthenticatedUser) {
    const name = this.normalizeName(dto?.name);
    if (dto?.parentId !== undefined && dto.parentId !== null &&
        (typeof dto.parentId !== 'string' || !dto.parentId.trim())) {
      throw new BadRequestException('parentId must be a non-empty folder ID');
    }

    return this.withMutationTransaction(async (tx) => {
      const scope = await this.resolveScope(projectId, user, tx);
      await this.assertCanManage(scope, user, tx);
      await this.lockScope(tx, scope);

      let parentId: string | null = null;
      if (dto.parentId) {
        const parent = await tx.documentFolder.findUnique({ where: { id: dto.parentId } });
        if (!parent) throw new NotFoundException('Parent folder not found');
        this.assertSameScope(parent, scope);
        await this.lockFolder(tx, parent.id);
        const lockedParent = await tx.documentFolder.findUnique({ where: { id: parent.id } });
        if (!lockedParent) throw new NotFoundException('Parent folder not found');
        this.assertSameScope(lockedParent, scope);
        if (!lockedParent.allow_custom_children) {
          throw new ConflictException('This folder does not allow custom child folders');
        }
        parentId = lockedParent.id;
      }

      await this.assertSiblingNameAvailable(tx, scope, parentId, name);
      const folder = await tx.documentFolder.create({
        data: {
          name,
          parent_id: parentId,
          organization_id: scope.organizationId,
          project_id: scope.projectId,
          created_by: user.id,
          template_folder_key: null,
          source_template_version_id: null,
          protection_policy: ProjectFolderProtectionPolicyEnum.STANDARD,
          allow_custom_children: true,
        },
      });
      await this.writeAudit(tx, scope, user, 'DOCUMENT_FOLDER_CREATED', folder.id, null, this.auditSnapshot(folder));
      return folder;
    });
  }

  async rename(folderId: string, dto: RenameDocumentFolderDto, user: AuthenticatedUser) {
    const name = this.normalizeName(dto?.name);
    const preliminary = await this.requireFolder(folderId, this.prisma);
    const scope = this.scopeOf(preliminary);
    await this.assertCanManage(scope, user, this.prisma);

    return this.withMutationTransaction(async (tx) => {
      await this.lockScope(tx, scope);
      await this.lockFolder(tx, folderId);
      const current = await this.requireFolder(folderId, tx);
      this.assertSameScope(current, scope);
      await this.assertCanManage(scope, user, tx);
      this.assertCustomFolder(current);
      this.assertCanRenameOrMove(current);
      if (current.name === name) return current;

      await this.assertSiblingNameAvailable(tx, scope, current.parent_id, name, current.id);
      const updated = await tx.documentFolder.update({
        where: { id: current.id },
        data: { name },
      });
      await this.writeAudit(
        tx,
        scope,
        user,
        'DOCUMENT_FOLDER_RENAMED',
        current.id,
        this.auditSnapshot(current),
        this.auditSnapshot(updated),
      );
      return updated;
    });
  }

  async move(folderId: string, parentId: string | null, user: AuthenticatedUser) {
    if (parentId !== null && (typeof parentId !== 'string' || !parentId.trim())) {
      throw new BadRequestException('parentId must be a folder ID or null');
    }
    const preliminary = await this.requireFolder(folderId, this.prisma);
    const scope = this.scopeOf(preliminary);
    await this.assertCanManage(scope, user, this.prisma);

    return this.withMutationTransaction(async (tx) => {
      await this.lockScope(tx, scope);
      await this.lockFolder(tx, folderId);
      const current = await this.requireFolder(folderId, tx);
      this.assertSameScope(current, scope);
      await this.assertCanManage(scope, user, tx);
      this.assertCustomFolder(current);
      this.assertCanRenameOrMove(current);

      if (parentId === current.parent_id) return current;
      if (parentId === current.id) throw new ConflictException('A folder cannot be its own parent');

      if (parentId !== null) {
        const parent = await tx.documentFolder.findUnique({ where: { id: parentId } });
        if (!parent) throw new NotFoundException('Destination parent folder not found');
        this.assertSameScope(parent, scope);
        await this.lockFolder(tx, parent.id);
        const lockedParent = await tx.documentFolder.findUnique({ where: { id: parent.id } });
        if (!lockedParent) throw new NotFoundException('Destination parent folder not found');
        this.assertSameScope(lockedParent, scope);
        if (!lockedParent.allow_custom_children) {
          throw new ConflictException('Destination folder does not allow custom child folders');
        }
        const cycle = await this.wouldCreateCycle(tx, current.id, lockedParent.id);
        if (cycle) throw new ConflictException('A folder cannot be moved inside its descendant');
      }

      await this.assertSiblingNameAvailable(tx, scope, parentId, current.name, current.id);
      const updated = await tx.documentFolder.update({
        where: { id: current.id },
        data: { parent_id: parentId },
      });
      await this.writeAudit(
        tx,
        scope,
        user,
        'DOCUMENT_FOLDER_MOVED',
        current.id,
        this.auditSnapshot(current),
        this.auditSnapshot(updated),
      );
      return updated;
    });
  }

  async delete(folderId: string, user: AuthenticatedUser): Promise<{ id: string; deleted: true }> {
    const preliminary = await this.requireFolder(folderId, this.prisma);
    const scope = this.scopeOf(preliminary);
    await this.assertCanManage(scope, user, this.prisma);

    return this.withMutationTransaction(async (tx) => {
      await this.lockScope(tx, scope);
      await this.lockFolder(tx, folderId);
      const current = await this.requireFolder(folderId, tx);
      this.assertSameScope(current, scope);
      await this.assertCanManage(scope, user, tx);
      this.assertCustomFolder(current);
      this.assertCanDelete(current);

      const [childCount, documentCount] = await Promise.all([
        tx.documentFolder.count({ where: { parent_id: current.id } }),
        // No is_archived predicate: archived documents still occupy a folder.
        tx.document.count({ where: { folder_id: current.id } }),
      ]);
      if (childCount > 0 || documentCount > 0) {
        throw new ConflictException('Only empty folders can be deleted');
      }

      await tx.documentFolder.delete({ where: { id: current.id } });
      await this.writeAudit(
        tx,
        scope,
        user,
        'DOCUMENT_FOLDER_DELETED',
        current.id,
        this.auditSnapshot(current),
        null,
      );
      return { id: current.id, deleted: true };
    });
  }

  private async resolveScope(
    projectId: string | undefined,
    user: AuthenticatedUser,
    db: FolderDb,
  ): Promise<FolderScope> {
    if (projectId !== undefined && !projectId.trim()) {
      throw new BadRequestException('projectId must be a non-empty project ID');
    }
    const organizationId = user.organizationId?.trim();
    if (!organizationId) throw new ForbiddenException('An authenticated organization is required');
    if (!projectId) return { organizationId, projectId: null };

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, organization_id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.organization_id !== organizationId) {
      throw new ForbiddenException('You do not have access to this project');
    }
    await this.assertProjectMembership(project.id, user, db);
    return { organizationId: project.organization_id, projectId: project.id };
  }

  private async assertCanManage(scope: FolderScope, user: AuthenticatedUser, db: FolderDb): Promise<void> {
    const authenticatedOrganization = user.organizationId?.trim();
    if (!authenticatedOrganization || authenticatedOrganization !== scope.organizationId) {
      throw new ForbiddenException('You do not have access to this folder scope');
    }
    if (await this.canManage(scope, user, db)) return;
    throw new ForbiddenException('Missing documents:folder_manage permission');
  }

  private async canManage(scope: FolderScope, user: AuthenticatedUser, db: FolderDb): Promise<boolean> {
    const authenticatedOrganization = user.organizationId?.trim();
    if (!authenticatedOrganization || authenticatedOrganization !== scope.organizationId) return false;
    if (scope.projectId) {
      const verifiedScope = await this.resolveScope(scope.projectId, user, db);
      if (verifiedScope.organizationId !== scope.organizationId) return false;
    }
    if (user.role === UserRoleEnum.ADMIN || user.role === UserRoleEnum.OWNER) return true;
    const permission = await db.rolePermission.findFirst({
      where: {
        role: { code: user.role },
        permission: { module: FOLDER_MANAGE_PERMISSION.module, action: FOLDER_MANAGE_PERMISSION.action },
      },
      select: { role_id: true },
    });
    return Boolean(permission);
  }

  private async assertProjectMembership(projectId: string, user: AuthenticatedUser, db: FolderDb): Promise<void> {
    if (isGlobalProjectScopeRole(user.role)) return;
    const member = await db.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: user.id } },
      select: { user_id: true },
    });
    if (!member) throw new ForbiddenException('You are not a member of this project');
  }

  private async requireFolder(folderId: string, db: FolderDb) {
    if (!folderId?.trim()) throw new BadRequestException('A valid folder ID is required');
    const folder = await db.documentFolder.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Folder not found');
    return folder;
  }

  private scopeOf(folder: { organization_id: string; project_id: string | null }): FolderScope {
    return { organizationId: folder.organization_id, projectId: folder.project_id };
  }

  private assertSameScope(
    folder: { organization_id: string; project_id: string | null },
    scope: FolderScope,
  ): void {
    if (folder.organization_id !== scope.organizationId || folder.project_id !== scope.projectId) {
      throw new ConflictException('Folders must remain within the same organization and project scope');
    }
  }

  private assertCustomFolder(folder: {
    template_folder_key: string | null;
    source_template_version_id: string | null;
  }): void {
    if (folder.template_folder_key !== null || folder.source_template_version_id !== null) {
      throw new ForbiddenException('Template-derived folders cannot be renamed, moved, or deleted');
    }
  }

  private assertCanRenameOrMove(folder: { protection_policy: ProjectFolderProtectionPolicyEnum }): void {
    if (folder.protection_policy === ProjectFolderProtectionPolicyEnum.IMMUTABLE) {
      throw new ForbiddenException('Immutable folders cannot be renamed or moved');
    }
  }

  private assertCanDelete(folder: { protection_policy: ProjectFolderProtectionPolicyEnum }): void {
    if (folder.protection_policy !== ProjectFolderProtectionPolicyEnum.STANDARD) {
      throw new ForbiddenException('This folder protection policy does not permit deletion');
    }
  }

  private async assertSiblingNameAvailable(
    tx: FolderTx,
    scope: FolderScope,
    parentId: string | null,
    name: string,
    excludeFolderId?: string,
  ): Promise<void> {
    const siblings = await tx.documentFolder.findMany({
      where: {
        organization_id: scope.organizationId,
        project_id: scope.projectId,
        parent_id: parentId,
        ...(excludeFolderId ? { id: { not: excludeFolderId } } : {}),
      },
      select: { id: true, name: true },
    });
    const normalizedName = name.trim().toLowerCase();
    if (siblings.some((sibling) => sibling.name.trim().toLowerCase() === normalizedName)) {
      throw new ConflictException('A folder with that name already exists at this level');
    }
  }

  private async wouldCreateCycle(tx: FolderTx, folderId: string, newParentId: string): Promise<boolean> {
    const descendants = await tx.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE descendants("id") AS (
        SELECT "id" FROM "document_folders" WHERE "parent_id" = ${folderId}
        UNION
        SELECT child."id"
        FROM "document_folders" AS child
        JOIN descendants AS parent ON child."parent_id" = parent."id"
      )
      SELECT "id" FROM descendants WHERE "id" = ${newParentId} LIMIT 1
    `;
    return descendants.length > 0;
  }

  private async lockScope(tx: FolderTx, scope: FolderScope): Promise<void> {
    const projectLock = scope.projectId ?? COMPANY_SCOPE_LOCK;
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${scope.organizationId}), hashtext(${projectLock}))
    `;
  }

  private async lockFolder(tx: FolderTx, folderId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "document_folders" WHERE "id" = ${folderId} FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException('Folder not found');
  }

  private async withMutationTransaction<T>(operation: (tx: FolderTx) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === 'P2002') throw new ConflictException('A folder with that name or template key already exists');
      if (code === 'P2034' || code === '40001') {
        throw new ConflictException('A concurrent folder change was detected; reload and retry');
      }
      if (code === 'P2004') throw new ConflictException('The requested folder change violates a database integrity rule');
      throw error;
    }
  }

  private async writeAudit(
    tx: FolderTx,
    scope: FolderScope,
    user: AuthenticatedUser,
    action: string,
    folderId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        organization_id: scope.organizationId,
        actor_id: user.id,
        action,
        entity: 'DocumentFolder',
        entity_id: folderId,
        before_state: before === null ? Prisma.DbNull : before as Prisma.InputJsonValue,
        after_state: after === null ? Prisma.DbNull : after as Prisma.InputJsonValue,
      },
    });
  }

  private auditSnapshot(folder: {
    id: string;
    name: string;
    parent_id: string | null;
    organization_id: string;
    project_id: string | null;
    template_folder_key: string | null;
    source_template_version_id: string | null;
    protection_policy: ProjectFolderProtectionPolicyEnum;
    allow_custom_children: boolean;
  }): Record<string, unknown> {
    return {
      id: folder.id,
      name: folder.name,
      parentId: folder.parent_id,
      organizationId: folder.organization_id,
      projectId: folder.project_id,
      templateFolderKey: folder.template_folder_key,
      sourceTemplateVersionId: folder.source_template_version_id,
      protectionPolicy: folder.protection_policy,
      allowCustomChildren: folder.allow_custom_children,
    };
  }

  private normalizeName(value: unknown): string {
    if (typeof value !== 'string') throw new BadRequestException('Folder name must be a string');
    const name = value.trim();
    if (!name) throw new BadRequestException('Folder name cannot be empty');
    if (name.length > 120) throw new BadRequestException('Folder name cannot exceed 120 characters');
    return name;
  }
}
