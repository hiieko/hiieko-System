import { BadRequestException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { UploadController } from '../src/modules/upload/upload.controller';

describe('UploadController ownership scope', () => {
  const user = {
    id: 'user-1',
    email: 'user@hiieko.local',
    role: UserRoleEnum.WORKER,
    organizationId: 'org-1',
  };
  const file = {
    buffer: Buffer.from('contents'),
    mimetype: 'application/pdf',
    originalname: 'company.pdf',
    size: 8,
  } as any;
  let uploadService: { uploadFile: jest.Mock };
  let controller: UploadController;

  beforeEach(() => {
    uploadService = { uploadFile: jest.fn().mockResolvedValue({ documentId: 'doc-1' }) };
    controller = new UploadController(uploadService as any);
  });

  it('passes an omitted project scope as an organization-scoped company upload', async () => {
    await controller.upload(file, undefined, undefined, 'CONTRACT', 'Company policy', undefined, undefined, user);

    expect(uploadService.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ buffer: file.buffer }),
      undefined,
      undefined,
      user,
      { documentType: 'CONTRACT', title: 'Company policy', projectId: undefined },
    );
  });

  it('rejects a project id supplied in multipart fields instead of the authorized query', async () => {
    await expect(controller.upload(file, undefined, undefined, 'CONTRACT', undefined, 'project-1', undefined, user))
      .rejects.toThrow(BadRequestException);
    expect(uploadService.uploadFile).not.toHaveBeenCalled();
  });

  it('forwards the query project id and ignores any client organization field', async () => {
    await controller.upload(file, undefined, undefined, 'CONTRACT', undefined, undefined, 'project-1', user);

    expect(uploadService.uploadFile).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      undefined,
      user,
      { documentType: 'CONTRACT', title: undefined, projectId: 'project-1' },
    );
  });
});
