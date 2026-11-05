import { IsUUID } from 'class-validator';

export class LinkMicrosoftIdentityDto {
  @IsUUID()
  objectId!: string;
}
