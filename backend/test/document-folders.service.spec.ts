import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectFolderProtectionPolicyEnum, UserRoleEnum } from '@prisma/client';
import { DocumentFoldersService } from '../src/modules/documents/document-folders.service';

const project = { id: 'project-1', organization_id: 'org-1' };
const admin = { id: 'admin-1', email: 'admin@test.local', role: UserRoleEnum.ADMIN, organizationId: 'org-1' };
const manager = { id: 'manager-1', email: 'manager@test.local', role: UserRoleEnum.MANAGER, organizationId: 'org-1' };
const pm = { id: 'pm-1', email: 'pm@test.local', role: UserRoleEnum.PM, organizationId: 'org-1', projectRoles: { 'project-1': UserRoleEnum.PM } };

function folder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'folder-1',
    name: 'Engineering',
    parent_id: null,
    organization_id: 'org-1',
    project_id: null,
    created_by: admin.id,
    template_folder_key: null,
    source_template_version_id: null,
    protection_policy: ProjectFolderProtectionPolicyEnum.STANDARD,
    allow_custom_children: true,
    created_at: new Date('2026-11-01T00:00:00.000Z'),
    updated_at: new Date('2026-11-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createHarness(options: {
  folders?: any[];
  documents?: any[];
  projectRows?: Record<string, any>;
  member?: boolean;
  permission?: boolean;
  failAudit?: boolean;
} = {}) {
  const folders = [...(options.folders ?? [])];
  const documents = [...(options.documents ?? [])];
  const auditRows: any[] = [];
  let failAudit = options.failAudit ?? false;
  let transactionQueue: Promise<unknown> = Promise.resolve();

  const findFolder = (id: string) => folders.find((row) => row.id === id) ?? null;
  const matches = (row: any, where: any) => {
    if (where.organization_id !== undefined && row.organization_id !== where.organization_id) return false;
    if (where.project_id !== undefined && row.project_id !== where.project_id) return false;
    if (where.parent_id !== undefined && row.parent_id !== where.parent_id) return false;
    if (where.id?.not && row.id === where.id.not) return false;
    if (where.id && typeof where.id === 'string' && row.id !== where.id) return false;
    return true;
  };
  const isDescendant = (rootId: string, possibleDescendantId: string) => {
    const seen = new Set<string>();
    const visit = (parentId: string): boolean => {
      if (seen.has(parentId)) return false;
      seen.add(parentId);
      const children = folders.filter((candidate) => candidate.parent_id === parentId);
      return children.some((child) => child.id === possibleDescendantId || visit(child.id));
    };
    return visit(rootId);
  };

  const tx: any = {
    $queryRaw: jest.fn((parts: TemplateStringsArray, ...values: any[]) => {
      const query = Array.from(parts).join(' ');
      if (query.includes('pg_advisory_xact_lock')) return Promise.resolve([{ pg_advisory_xact_lock: null }]);
      if (query.includes('FOR UPDATE')) {
        const row = findFolder(values[0]);
        return Promise.resolve(row ? [{ id: row.id }] : []);
      }
      if (query.includes('WITH RECURSIVE')) {
        return Promise.resolve(isDescendant(values[0], values[1]) ? [{ id: values[1] }] : []);
      }
      return Promise.resolve([]);
    }),
    project: {
      findUnique: jest.fn(async ({ where }: any) => options.projectRows?.[where.id] ?? (where.id === project.id ? project : null)),
    },
    projectMember: {
      findUnique: jest.fn().mockImplementation(async () => options.member === false ? null : { user_id: pm.id }),
    },
    rolePermission: {
      findFirst: jest.fn().mockImplementation(async () => options.permission === false ? null : { role_id: 'pm-role' }),
    },
    documentFolder: {
      findUnique: jest.fn(async ({ where }: any) => findFolder(where.id)),
      findMany: jest.fn(async ({ where }: any) => folders.filter((row) => matches(row, where))),
      count: jest.fn(async ({ where }: any) => folders.filter((row) => matches(row, where)).length),
      create: jest.fn(async ({ data }: any) => {
        const row = folder({ id: `folder-${folders.length + 1}`, ...data });
        folders.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = findFolder(where.id);
        if (!row) throw new Error('row disappeared');
        Object.assign(row, data, { updated_at: new Date() });
        return { ...row };
      }),
      delete: jest.fn(async ({ where }: any) => {
        const index = folders.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('row disappeared');
        return folders.splice(index, 1)[0];
      }),
    },
    document: {
      count: jest.fn(async ({ where }: any) => documents.filter((doc) => doc.folder_id === where.folder_id).length),
    },
    documentVersion: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    attachment: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        if (failAudit) throw new Error('mandatory audit insert failed');
        const row = { id: `audit-${auditRows.length + 1}`, ...data };
        auditRows.push(row);
        return row;
      }),
    },
  };

  const prisma: any = {
    documentFolder: tx.documentFolder,
    project: tx.project,
    projectMember: tx.projectMember,
    rolePermission: tx.rolePermission,
    $transaction: jest.fn((callback: (client: any) => Promise<any>, _options?: any) => {
      const operation = transactionQueue.then(async () => {
        const savedFolders = folders.map((row) => ({ ...row }));
        const auditCount = auditRows.length;
        try {
          return await callback(tx);
        } catch (error) {
          folders.splice(0, folders.length, ...savedFolders);
          auditRows.splice(auditCount);
          throw error;
        }
      });
      transactionQueue = operation.then(() => undefined, () => undefined);
      return operation;
    }),
  };
  const service = new DocumentFoldersService(prisma);
  return {
    service,
    prisma,
    tx,
    folders,
    documents,
    auditRows,
    setAuditFailure: (value: boolean) => { failAudit = value; },
  };
}

describe('DocumentFoldersService', () => {
  it('lists company folders using authenticated organization scope only', async () => {
    const harness = createHarness({
      folders: [folder(), folder({ id: 'other-org-folder', organization_id: 'org-2' })],
    });

    const result = await harness.service.findAll(undefined, pm);

    expect(result.folders.map((row) => row.id)).toEqual(['folder-1']);
    expect(result.canManage).toBe(true);
    expect(harness.tx.documentFolder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organization_id: 'org-1', project_id: null },
    }));
  });

  it('lists project folders only after a current database membership check', async () => {
    const harness = createHarness({ folders: [folder({ project_id: project.id })] });

    await expect(harness.service.findAll(project.id, pm)).resolves.toMatchObject({
      folders: [{ id: 'folder-1' }],
      canManage: true,
    });
    expect(harness.tx.projectMember.findUnique).toHaveBeenCalledWith({
      where: { project_id_user_id: { project_id: project.id, user_id: pm.id } },
      select: { user_id: true },
    });
    expect(harness.tx.documentFolder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organization_id: 'org-1', project_id: project.id },
    }));
  });

  it('creates custom folders with server-derived ownership and a mandatory transactional audit', async () => {
    const harness = createHarness();
    const created = await harness.service.create(undefined, {
      name: '  Contracts  ',
      organizationId: 'org-attacker',
    } as any, pm);

    expect(created).toMatchObject({
      name: 'Contracts',
      organization_id: 'org-1',
      project_id: null,
      created_by: pm.id,
      template_folder_key: null,
      source_template_version_id: null,
      protection_policy: ProjectFolderProtectionPolicyEnum.STANDARD,
      allow_custom_children: true,
    });
    expect(harness.tx.documentFolder.create.mock.calls[0][0].data).not.toHaveProperty('organizationId');
    expect(harness.auditRows).toHaveLength(1);
    expect(harness.auditRows[0]).toMatchObject({
      organization_id: 'org-1',
      actor_id: pm.id,
      action: 'DOCUMENT_FOLDER_CREATED',
      entity: 'DocumentFolder',
    });
  });

  it('rejects cross-organization project scope and missing project membership', async () => {
    const spoofed = createHarness({ projectRows: { [project.id]: { ...project, organization_id: 'org-2' } } });
    await expect(spoofed.service.create(project.id, { name: 'Private' }, pm)).rejects.toThrow(ForbiddenException);
    expect(spoofed.tx.documentFolder.create).not.toHaveBeenCalled();

    const nonMember = createHarness({ member: false });
    await expect(nonMember.service.findAll(project.id, pm)).rejects.toThrow(ForbiddenException);
    await expect(nonMember.service.create(project.id, { name: 'No membership' }, pm)).rejects.toThrow(ForbiddenException);
    expect(nonMember.tx.documentFolder.findMany).not.toHaveBeenCalled();
    expect(nonMember.tx.documentFolder.create).not.toHaveBeenCalled();

    const foreignCompanyFolder = createHarness({ folders: [folder({ organization_id: 'org-2' })] });
    await expect(foreignCompanyFolder.service.rename('folder-1', { name: 'Probe' }, pm))
      .rejects.toThrow(ForbiddenException);
    expect(foreignCompanyFolder.tx.documentFolder.update).not.toHaveBeenCalled();
  });

  it('requires the explicit permission for mutations while preserving Admin/Owner bypass', async () => {
    const denied = createHarness({ permission: false });
    await expect(denied.service.create(undefined, { name: 'Denied' }, pm)).rejects.toThrow(ForbiddenException);
    expect(denied.tx.documentFolder.create).not.toHaveBeenCalled();

    const adminHarness = createHarness({ permission: false });
    await expect(adminHarness.service.create(undefined, { name: 'Admin folder' }, admin)).resolves.toMatchObject({
      organization_id: 'org-1',
    });
    expect(adminHarness.tx.rolePermission.findFirst).not.toHaveBeenCalled();

    const permitted = createHarness();
    await permitted.service.create(undefined, { name: 'Permitted' }, pm);
    expect(permitted.tx.rolePermission.findFirst).toHaveBeenCalledWith({
      where: {
        role: { code: UserRoleEnum.PM },
        permission: { module: 'documents', action: 'folder_manage' },
      },
      select: { role_id: true },
    });
  });

  it('requires the permission even for globally scoped Managers', async () => {
    const denied = createHarness({ permission: false });
    await expect(denied.service.create(project.id, { name: 'Manager folder' }, manager)).rejects.toThrow(ForbiddenException);
    expect(denied.tx.projectMember.findUnique).not.toHaveBeenCalled();
  });

  it('validates parent scope and allow_custom_children on create', async () => {
    const crossScope = createHarness({ folders: [folder({ id: 'company-parent' })] });
    await expect(crossScope.service.create(project.id, { name: 'Child', parentId: 'company-parent' }, pm))
      .rejects.toThrow(ConflictException);
    expect(crossScope.tx.documentFolder.create).not.toHaveBeenCalled();

    const lockedParent = createHarness({ folders: [folder({ id: 'locked-parent', allow_custom_children: false })] });
    await expect(lockedParent.service.create(undefined, { name: 'Child', parentId: 'locked-parent' }, pm))
      .rejects.toThrow(ConflictException);
    expect(lockedParent.tx.documentFolder.create).not.toHaveBeenCalled();
  });

  it('enforces case-insensitive sibling uniqueness while keeping project/company roots separate', async () => {
    const harness = createHarness({ folders: [folder({ name: 'Finance' })] });
    await expect(harness.service.create(undefined, { name: ' finance ' }, pm)).rejects.toThrow(ConflictException);
    expect(harness.tx.documentFolder.create).not.toHaveBeenCalled();

    await expect(harness.service.create(project.id, { name: 'finance' }, pm)).resolves.toMatchObject({
      project_id: project.id,
      organization_id: 'org-1',
    });
  });

  it('renames mutable custom folders without changing provenance or scope', async () => {
    const harness = createHarness({ folders: [folder()] });
    const renamed = await harness.service.rename('folder-1', { name: '  Renamed  ' }, pm);
    expect(renamed.name).toBe('Renamed');
    expect(renamed.template_folder_key).toBeNull();
    expect(renamed.source_template_version_id).toBeNull();
    expect(renamed.organization_id).toBe('org-1');
    expect(harness.tx.documentFolder.update).toHaveBeenCalledWith({
      where: { id: 'folder-1' },
      data: { name: 'Renamed' },
    });
  });

  it('applies the rename/move policy to STANDARD, NO_DELETE, and IMMUTABLE custom folders', async () => {
    const standard = createHarness({ folders: [folder()] });
    await expect(standard.service.rename('folder-1', { name: 'Standard' }, pm)).resolves.toMatchObject({ name: 'Standard' });

    const noDelete = createHarness({ folders: [folder({ protection_policy: ProjectFolderProtectionPolicyEnum.NO_DELETE })] });
    await expect(noDelete.service.rename('folder-1', { name: 'Renamed' }, pm)).resolves.toMatchObject({ name: 'Renamed' });
    noDelete.folders.push(folder({ id: 'destination', name: 'Destination' }));
    await expect(noDelete.service.move('folder-1', 'destination', pm)).resolves.toMatchObject({ parent_id: 'destination' });
    await expect(noDelete.service.delete('folder-1', pm)).rejects.toThrow(ForbiddenException);

    const immutable = createHarness({ folders: [folder({ protection_policy: ProjectFolderProtectionPolicyEnum.IMMUTABLE })] });
    await expect(immutable.service.rename('folder-1', { name: 'Renamed' }, pm)).rejects.toThrow(ForbiddenException);
    await expect(immutable.service.move('folder-1', null, pm)).rejects.toThrow(ForbiddenException);
    await expect(immutable.service.delete('folder-1', pm)).rejects.toThrow(ForbiddenException);
  });

  it('never renames, moves, or deletes template-derived folders', async () => {
    const variants = [
      folder({ template_folder_key: 'CORE', source_template_version_id: 'template-version-1' }),
      folder({ template_folder_key: 'CORE', source_template_version_id: null }),
      folder({ template_folder_key: null, source_template_version_id: 'template-version-1' }),
    ];
    for (const templateFolder of variants) {
      const harness = createHarness({ folders: [templateFolder] });
      await expect(harness.service.rename(templateFolder.id, { name: 'Changed' }, admin)).rejects.toThrow(ForbiddenException);
      await expect(harness.service.move(templateFolder.id, null, admin)).rejects.toThrow(ForbiddenException);
      await expect(harness.service.delete(templateFolder.id, admin)).rejects.toThrow(ForbiddenException);
      expect(harness.tx.documentFolder.update).not.toHaveBeenCalled();
      expect(harness.tx.documentFolder.delete).not.toHaveBeenCalled();
    }
  });

  it('moves custom folders within scope and supports an explicit root move', async () => {
    const source = folder({ id: 'source', parent_id: 'parent-a' });
    const parentA = folder({ id: 'parent-a', name: 'A' });
    const parentB = folder({ id: 'parent-b', name: 'B' });
    const harness = createHarness({ folders: [source, parentA, parentB] });

    await expect(harness.service.move('source', 'parent-b', pm)).resolves.toMatchObject({ parent_id: 'parent-b' });
    await expect(harness.service.move('source', null, pm)).resolves.toMatchObject({ parent_id: null });
    expect(harness.auditRows.map((row) => row.action)).toEqual(['DOCUMENT_FOLDER_MOVED', 'DOCUMENT_FOLDER_MOVED']);
  });

  it('rejects cross-scope, self-parent, descendant, and disallowed-child moves', async () => {
    const source = folder({ id: 'source', name: 'Source' });
    const child = folder({ id: 'child', name: 'Child', parent_id: 'source' });
    const companyParent = folder({ id: 'company-parent', name: 'Company parent' });
    const lockedParent = folder({ id: 'locked-parent', name: 'Locked', allow_custom_children: false });
    const harness = createHarness({ folders: [source, child, companyParent, lockedParent] });

    await expect(harness.service.move('source', 'source', pm)).rejects.toThrow(ConflictException);
    await expect(harness.service.move('source', 'child', pm)).rejects.toThrow(ConflictException);
    await expect(harness.service.move('source', 'company-parent', pm)).resolves.toMatchObject({ parent_id: 'company-parent' });
    const projectFolder = folder({ id: 'project-folder', project_id: project.id });
    const crossProject = createHarness({ folders: [source, projectFolder] });
    await expect(crossProject.service.move('source', 'project-folder', pm)).rejects.toThrow(ConflictException);
    await expect(harness.service.move('source', 'locked-parent', pm)).rejects.toThrow(ConflictException);
  });

  it('rejects sibling name conflicts when moving a folder', async () => {
    const source = folder({ id: 'source', name: 'Shared', parent_id: 'parent-a' });
    const sibling = folder({ id: 'sibling', name: ' shared ', parent_id: 'parent-b' });
    const parentA = folder({ id: 'parent-a', name: 'A' });
    const parentB = folder({ id: 'parent-b', name: 'B' });
    const harness = createHarness({ folders: [source, sibling, parentA, parentB] });

    await expect(harness.service.move('source', 'parent-b', pm)).rejects.toThrow(ConflictException);
    expect(harness.tx.documentFolder.update).not.toHaveBeenCalled();
  });

  it('deletes only empty STANDARD custom folders and retains document data', async () => {
    const docs = [
      { id: 'doc-active', folder_id: 'elsewhere', is_archived: false },
      { id: 'doc-archived', folder_id: 'elsewhere', is_archived: true },
    ];
    const harness = createHarness({ folders: [folder()], documents: docs });
    const beforeDocuments = structuredClone(docs);
    const result = await harness.service.delete('folder-1', pm);

    expect(result).toEqual({ id: 'folder-1', deleted: true });
    expect(harness.documents).toEqual(beforeDocuments);
    expect(harness.auditRows[0]).toMatchObject({ action: 'DOCUMENT_FOLDER_DELETED', entity_id: 'folder-1' });
    expect(harness.tx.document.update).toBeUndefined();
    expect(harness.tx.document.delete).toBeUndefined();
    expect(harness.tx.documentVersion.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.documentVersion.delete).not.toHaveBeenCalled();
    expect(harness.tx.attachment.deleteMany).not.toHaveBeenCalled();
    expect(harness.tx.attachment.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion when children or active/archived documents reference the folder', async () => {
    const parent = folder({ id: 'parent' });
    const child = folder({ id: 'child', parent_id: 'parent' });
    const withChild = createHarness({ folders: [parent, child] });
    await expect(withChild.service.delete('parent', pm)).rejects.toThrow(ConflictException);

    for (const is_archived of [false, true]) {
      const withDocument = createHarness({
        folders: [parent],
        documents: [{ id: `document-${is_archived}`, folder_id: 'parent', is_archived }],
      });
      await expect(withDocument.service.delete('parent', pm)).rejects.toThrow(ConflictException);
      expect(withDocument.tx.document.count).toHaveBeenCalledWith({ where: { folder_id: 'parent' } });
      expect(withDocument.tx.documentFolder.delete).not.toHaveBeenCalled();
    }
  });

  it('rolls back folder creation if the mandatory audit insert fails', async () => {
    const harness = createHarness({ failAudit: true });
    await expect(harness.service.create(undefined, { name: 'Audited' }, pm)).rejects.toThrow('mandatory audit insert failed');
    expect(harness.folders).toHaveLength(0);
  });

  it('serializes concurrent creates and rejects duplicate names without duplicate rows', async () => {
    const harness = createHarness();
    const results = await Promise.allSettled([
      harness.service.create(undefined, { name: 'Concurrent' }, pm),
      harness.service.create(undefined, { name: ' concurrent ' }, pm),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(harness.folders).toHaveLength(1);
    expect(harness.auditRows).toHaveLength(1);
    expect(harness.tx.$queryRaw.mock.calls.some(([parts]: any[]) => Array.from(parts).join(' ').includes('pg_advisory_xact_lock'))).toBe(true);
  });

  it('serializes concurrent moves so they cannot jointly create a cycle', async () => {
    const a = folder({ id: 'a', name: 'A' });
    const b = folder({ id: 'b', name: 'B' });
    const harness = createHarness({ folders: [a, b] });
    const results = await Promise.allSettled([
      harness.service.move('a', 'b', pm),
      harness.service.move('b', 'a', pm),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const moved = harness.folders.find((row) => row.parent_id !== null);
    expect(moved).toBeDefined();
    expect(harness.auditRows).toHaveLength(1);
  });

  it('serializes concurrent renames and deletions', async () => {
    const renameHarness = createHarness({ folders: [folder({ id: 'rename-a' }), folder({ id: 'rename-b', name: 'Other' })] });
    const renameResults = await Promise.allSettled([
      renameHarness.service.rename('rename-a', { name: 'Same' }, pm),
      renameHarness.service.rename('rename-b', { name: ' same ' }, pm),
    ]);
    expect(renameResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(renameResults.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const deleteHarness = createHarness({ folders: [folder()] });
    const deleteResults = await Promise.allSettled([
      deleteHarness.service.delete('folder-1', pm),
      deleteHarness.service.delete('folder-1', pm),
    ]);
    expect(deleteResults.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(deleteResults.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(deleteHarness.folders).toHaveLength(0);
    expect(deleteHarness.auditRows).toHaveLength(1);
  });

  it('returns NotFound for unknown folders and rejects client-supplied organization ownership', async () => {
    const harness = createHarness();
    await expect(harness.service.rename('missing', { name: 'Name' }, admin)).rejects.toThrow(NotFoundException);
    await expect(harness.service.create(undefined, { name: 'Spoof', organizationId: 'org-attacker' } as any, admin))
      .resolves.toMatchObject({ organization_id: 'org-1' });
  });
});
