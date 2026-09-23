import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationPriorityEnum, NotificationChannelEnum } from '@prisma/client';

export interface SendNotificationDto {
  userId: string;
  titleRo: string;
  titleEn?: string;
  messageRo: string;
  messageEn?: string;
  priority?: NotificationPriorityEnum;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  category?: string;
  /** Optional: the ID of the entity that triggered the notification (e.g. report id, expense id) */
  entityId?: string;
  /** Optional: the type of entity that triggered the notification (e.g. 'daily_report', 'expense') */
  entity?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getUserNotifications(
    userId: string,
    unreadOnly = false,
    page = 1,
    pageSize = 50,
  ): Promise<PaginatedResult<any>> {
    const skip = (page - 1) * pageSize;
    const where = {
      user_id: userId,
      is_read: unreadOnly ? false : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async send(dto: SendNotificationDto) {
    // 1. Check user preferences for channel enablement
    const pref = dto.category
      ? await this.prisma.notificationPreference.findUnique({
          where: {
            user_id_category_channel: {
              user_id: dto.userId,
              category: dto.category,
              channel: NotificationChannelEnum.IN_APP,
            },
          },
        })
      : null;

    if (pref && !pref.is_enabled) {
      this.logger.log(`Notification skipped by user preference for user ${dto.userId}`);
      return null;
    }

    // 2. Persist in-app notification
    const notification = await this.prisma.notification.create({
      data: {
        user_id: dto.userId,
        title_ro: dto.titleRo,
        title_en: dto.titleEn,
        message_ro: dto.messageRo,
        message_en: dto.messageEn,
        priority: dto.priority || NotificationPriorityEnum.NORMAL,
        action_url: dto.actionUrl,
        metadata: dto.metadata as any,
      },
    });

    this.logger.log(`[NOTIFICATION DISPATCH] User: ${dto.userId} | Title: ${dto.titleRo}`);

    // 3. Audit log the notification send
    await this.auditService.record({
      actorId: undefined, // system-generated notification
      action: 'NOTIFICATION_SENT',
      entity: dto.entity || 'notification',
      entityId: dto.entityId || notification.id,
      metadata: {
        notificationId: notification.id,
        userId: dto.userId,
        titleRo: dto.titleRo,
        category: dto.category,
      } as Record<string, unknown>,
    });

    return notification;
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  }
}
