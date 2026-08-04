import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: { companyId?: string; assetId?: string }) {
    return this.prisma.maintenanceRecord.findMany({
      where: {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  async create(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const assetId = String(body.assetId || '');
    const title = String(body.title || '');
    const performedAt = String(body.performedAt || '');
    if (!companyId || !assetId || !title || !performedAt) {
      throw new BadRequestException(
        'companyId, assetId, title, and performedAt are required',
      );
    }
    return this.prisma.maintenanceRecord.create({
      data: {
        companyId,
        assetId,
        unitNo: String(body.unitNo || ''),
        type: String(body.type || 'repair'),
        title,
        description: String(body.description || ''),
        cost: Number(body.cost || 0),
        performedAt,
        nextDueAt: body.nextDueAt ? String(body.nextDueAt) : null,
        odometer:
          body.odometer !== undefined && body.odometer !== null
            ? Number(body.odometer)
            : null,
        vendor: String(body.vendor || ''),
      },
    });
  }

  async update(id: string, body: Record<string, unknown>) {
    await this.ensure(id);
    return this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        title: body.title !== undefined ? String(body.title) : undefined,
        description:
          body.description !== undefined ? String(body.description) : undefined,
        type: body.type !== undefined ? String(body.type) : undefined,
        cost: body.cost !== undefined ? Number(body.cost) : undefined,
        performedAt:
          body.performedAt !== undefined ? String(body.performedAt) : undefined,
        nextDueAt:
          body.nextDueAt !== undefined
            ? body.nextDueAt
              ? String(body.nextDueAt)
              : null
            : undefined,
        odometer:
          body.odometer !== undefined
            ? body.odometer === null
              ? null
              : Number(body.odometer)
            : undefined,
        vendor: body.vendor !== undefined ? String(body.vendor) : undefined,
        unitNo: body.unitNo !== undefined ? String(body.unitNo) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.maintenanceRecord.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const row = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Maintenance ${id} not found`);
    return row;
  }
}
