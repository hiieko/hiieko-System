import { ProjectRequirementStateEnum, ProjectTypeEnum } from '@prisma/client';
import { IsIn, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class SetProjectRequirementAssessmentDto {
  @IsIn([ProjectRequirementStateEnum.APPLICABLE, ProjectRequirementStateEnum.NOT_APPLICABLE])
  state!: ProjectRequirementStateEnum;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  note!: string;
}

export class AdoptLatestProjectRequirementCatalogDto {
  /** Existing projects are classified only through this explicit review. */
  @IsIn([
    ProjectTypeEnum.RESIDENTIAL_SOLAR,
    ProjectTypeEnum.COMMERCIAL_SOLAR,
    ProjectTypeEnum.INDUSTRIAL_SOLAR,
    ProjectTypeEnum.OTHER_CUSTOM,
  ])
  projectType!: ProjectTypeEnum;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Matches(/\S/)
  reason!: string;
}
