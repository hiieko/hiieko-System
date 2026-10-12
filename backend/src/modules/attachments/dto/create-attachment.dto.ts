import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The five construction targets a photo/file may be linked to.
 * Kept in sync with ATTACHMENT_TARGET_TYPES in attachments.service.ts.
 */
export const ATTACHMENT_TARGET_TYPES = [
  'task',
  'daily_report',
  'issue',
  'inspection',
  'project',
] as const;
export type AttachmentTargetType = (typeof ATTACHMENT_TARGET_TYPES)[number];

/**
 * POST /api/attachments body. Links an already-uploaded document (POST /api/upload)
 * to one of the supported targets. Validated by the global ValidationPipe (main.ts):
 * an unknown target_type is a 422, never a silent write.
 */
export class CreateAttachmentDto {
  @IsString()
  @IsIn(ATTACHMENT_TARGET_TYPES, {
    message: `target_type must be one of: ${ATTACHMENT_TARGET_TYPES.join(', ')}`,
  })
  target_type!: AttachmentTargetType;

  @IsString()
  @IsNotEmpty({ message: 'target_id is required.' })
  @MaxLength(100)
  target_id!: string;

  /** Id of the Document returned by POST /api/upload (its `documentId`). */
  @IsString()
  @IsNotEmpty({ message: 'file_id is required.' })
  file_id!: string;

  /** Optional human caption for the attachment. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}
