import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateDocumentFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parentId?: string | null;
}

export class RenameDocumentFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class MoveDocumentFolderDto {
  /** Required property; null explicitly moves the folder to its scope root. */
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  parentId!: string | null;
}

export class MoveDocumentToFolderDto {
  /** Required property; null explicitly files the document as unfiled. */
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  folderId!: string | null;
}
