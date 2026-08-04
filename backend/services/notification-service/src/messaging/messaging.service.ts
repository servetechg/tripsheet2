import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  listMessages(companyId?: string, toUserId?: string) {
    return this.prisma.message.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(toUserId ? { toUserId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createMessage(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const fromUserId = String(body.fromUserId || '');
    const text = String(body.body || '');
    if (!companyId || !fromUserId || !text) {
      throw new BadRequestException(
        'companyId, fromUserId, and body are required',
      );
    }
    return this.prisma.message.create({
      data: {
        companyId,
        threadType: String(body.threadType || 'driver'),
        fromUserId,
        fromName: String(body.fromName || ''),
        toUserId: body.toUserId ? String(body.toUserId) : null,
        toName: String(body.toName || ''),
        loadId: body.loadId ? String(body.loadId) : null,
        body: text,
      },
    });
  }

  async markRead(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { readAt: new Date().toISOString() },
    });
  }

  listComments(companyId?: string, entityType?: string, entityId?: string) {
    return this.prisma.comment.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async createComment(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const entityType = String(body.entityType || '');
    const entityId = String(body.entityId || '');
    const userId = String(body.userId || '');
    const text = String(body.body || '');
    if (!companyId || !entityType || !entityId || !userId || !text) {
      throw new BadRequestException(
        'companyId, entityType, entityId, userId, and body are required',
      );
    }
    return this.prisma.comment.create({
      data: {
        companyId,
        entityType,
        entityId,
        userId,
        userName: String(body.userName || ''),
        body: text,
      },
    });
  }
}
