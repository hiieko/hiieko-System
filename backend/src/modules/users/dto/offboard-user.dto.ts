import { IsUUID } from 'class-validator';

export class OffboardUserDto {
  @IsUUID()
  replacementUserId!: string;
}
