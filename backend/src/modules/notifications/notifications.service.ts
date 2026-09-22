import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
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
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserNotifications(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        user_id: userId,
        is_read: unreadOnly ? false : undefined,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
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
