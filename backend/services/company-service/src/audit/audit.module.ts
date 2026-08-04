import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
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

  async create(body: Record<string, unknown>) {
    const action = String(body.action || '');
    if (!action) throw new BadRequestException('action is required');
    return this.prisma.auditEvent.create({
      data: {
        companyId: body.companyId ? String(body.companyId) : null,
        actorId: body.actorId ? String(body.actorId) : null,
        actorName: String(body.actorName || ''),
        action,
        entityType: String(body.entityType || ''),
        entityId: String(body.entityId || ''),
        meta: (body.meta as object) ?? undefined,
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
  create(@Body() body: Record<string, unknown>) {
    return this.audit.create(body);
  }
}

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
