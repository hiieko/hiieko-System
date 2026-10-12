import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { ProjectAccessGuard } from '../../common/auth/guards/project-access.guard';
import { RequireProjectAccess } from '../../common/auth/decorators/auth-metadata.decorator';
import { RateLimit } from '../../common/auth/decorators/rate-limit.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth.types';

@ApiTags('Attachments')
@Controller('api/attachments')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @RequireProjectAccess('projectId')
  @RateLimit({ scope: 'user', limit: 60, windowMs: 3_600_000 })
  @ApiOperation({ summary: 'Link an uploaded file to a task/daily_report/issue/inspection/project' })
  async create(
    @Body() dto: CreateAttachmentDto,
    @Query('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentsService.create(dto, projectId, user);
  }

  @Get()
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'List attachments for a target (newest first)' })
  async findAll(
    @Query('target_type') targetType: string,
    @Query('target_id') targetId: string,
    @Query('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentsService.findAll(targetType, targetId, projectId, user);
  }

  @Delete(':id')
  @RequireProjectAccess('projectId')
  @ApiOperation({ summary: 'Remove an attachment link (keeps the stored blob)' })
  async remove(
    @Param('id') id: string,
    @Query('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentsService.remove(id, projectId, user);
  }
}
