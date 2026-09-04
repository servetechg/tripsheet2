import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId?: string, limit = 100) {
    return this.prisma.auditEvent.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async create(body: Record<string, unknown>, req?: Request) {
    const action = String(body.action || '');
    if (!action) throw new BadRequestException('action is required');
    const ip =
      String(body.ip || '') ||
      String(req?.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req?.socket?.remoteAddress ||
      '';
    const userAgent =
      String(body.userAgent || '') || String(req?.headers['user-agent'] || '');
    return this.prisma.auditEvent.create({
      data: {
        companyId: body.companyId ? String(body.companyId) : null,
        actorId: body.actorId
          ? String(body.actorId)
          : req?.headers['x-user-id']
            ? String(req.headers['x-user-id'])
            : null,
        actorName:
          String(body.actorName || '') ||
          String(req?.headers['x-user-email'] || ''),
        action,
        entityType: String(body.entityType || ''),
        entityId: String(body.entityId || ''),
        meta: (body.meta as object) ?? undefined,
        ip,
        userAgent: userAgent.slice(0, 500),
        before: (body.before as object) ?? undefined,
        after: (body.after as object) ?? undefined,
      },
    });
  }
}

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(companyId, limit ? Number(limit) : 100);
  }

  @Post()
  create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.audit.create(body, req);
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
