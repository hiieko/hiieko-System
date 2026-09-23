import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditService } from '../src/common/audit/audit.service';
import { NotificationPriorityEnum, NotificationChannelEnum } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn(),
      },
    };

    audit = {
      record: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // send()
  // ──────────────────────────────────────────────
  describe('send', () => {
    it('should create a notification and record an audit log', async () => {
      const notification = {
        id: 'notif-1',
        user_id: 'user-1',
        title_ro: 'Test title',
        title_en: 'Test title EN',
        message_ro: 'Test message',
        message_en: 'Test message EN',
        priority: NotificationPriorityEnum.NORMAL,
      };

      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue(notification);

      const result = await service.send({
        userId: 'user-1',
        titleRo: 'Test title',
        titleEn: 'Test title EN',
        messageRo: 'Test message',
        messageEn: 'Test message EN',
        category: 'test_category',
      });

      expect(result).toEqual(notification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-1',
          title_ro: 'Test title',
          message_ro: 'Test message',
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'NOTIFICATION_SENT',
          entity: 'notification',
          metadata: expect.objectContaining({
            notificationId: 'notif-1',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('should skip sending when user preference is disabled', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue({
        user_id: 'user-1',
        category: 'test_category',
        channel: NotificationChannelEnum.IN_APP,
        is_enabled: false,
      });

      const result = await service.send({
        userId: 'user-1',
        titleRo: 'Skipped',
        messageRo: 'Should not be sent',
        category: 'test_category',
      });

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('should send notification when no category is provided', async () => {
      const notification = { id: 'notif-2', user_id: 'user-1' };
      prisma.notification.create.mockResolvedValue(notification);

      const result = await service.send({
        userId: 'user-1',
        titleRo: 'No category',
        messageRo: 'Should pass',
      });

      expect(result).toEqual(notification);
      expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalled();
    });

    it('should default priority to NORMAL when not provided', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 'notif-3' });

      await service.send({
        userId: 'user-1',
        titleRo: 'Default priority',
        messageRo: 'Check priority default',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: NotificationPriorityEnum.NORMAL,
          }),
        }),
      );
    });

    it('should accept and persist optional entityId and entity fields', async () => {
      prisma.notificationPreference.findUnique.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 'notif-4' });

      await service.send({
        userId: 'user-1',
        titleRo: 'Entity linked',
        messageRo: 'Linked to expense',
        entity: 'expense',
        entityId: 'expense-123',
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'expense',
          entityId: 'expense-123',
        }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // getUserNotifications() — pagination
  // ──────────────────────────────────────────────
  describe('getUserNotifications', () => {
    const mockNotifs = [
      { id: 'n1', user_id: 'user-1', is_read: false, created_at: new Date('2026-09-21') },
      { id: 'n2', user_id: 'user-1', is_read: true, created_at: new Date('2026-09-20') },
    ];

    it('should return all notifications for the user with default pagination', async () => {
      prisma.notification.findMany.mockResolvedValue(mockNotifs);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.getUserNotifications('user-1');

      expect(result.data).toEqual(mockNotifs);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1', is_read: undefined },
          skip: 0,
          take: 50,
        }),
      );
    });

    it('should filter unread only when unreadOnly is true', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotifs[0]]);
      prisma.notification.count.mockResolvedValue(1);

      const result = await service.getUserNotifications('user-1', true);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].is_read).toBe(false);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1', is_read: false },
        }),
      );
    });

    it('should paginate correctly with skip/take', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotifs[1]]);
      prisma.notification.count.mockResolvedValue(2);

      const result = await service.getUserNotifications('user-1', false, 2, 1);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 1, take: 1 }),
      );
    });

    it('should return empty data array when no notifications exist', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      const result = await service.getUserNotifications('user-1');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ──────────────────────────────────────────────
  // markAsRead()
  // ──────────────────────────────────────────────
  describe('markAsRead', () => {
    it('should mark a notification as read with user ownership', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result).toEqual({ count: 1 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', user_id: 'user-1' },
        data: { is_read: true, read_at: expect.any(Date) },
      });
    });

    it('should NOT mark notification as read for a different user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAsRead('notif-1', 'user-2');

      expect(result).toEqual({ count: 0 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-1', user_id: 'user-2' },
        }),
      );
    });
  });

  // ──────────────────────────────────────────────
  // markAllAsRead()
  // ──────────────────────────────────────────────
  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for the user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ count: 3 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { user_id: 'user-1', is_read: false },
        data: { is_read: true, read_at: expect.any(Date) },
      });
    });

    it('should return count 0 when no unread notifications exist', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result).toEqual({ count: 0 });
    });
  });
});
