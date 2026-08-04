import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DvirService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: { companyId?: string; assetId?: string }) {
    return this.prisma.dvirInspection.findMany({
      where: {
        ...(query.companyId ? { companyId: query.companyId } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
      },
      orderBy: { inspectedAt: 'desc' },
    });
  }

  async create(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const assetId = String(body.assetId || '');
    const inspectedAt = String(body.inspectedAt || '');
    if (!companyId || !assetId || !inspectedAt) {
      throw new BadRequestException(
        'companyId, assetId, and inspectedAt are required',
      );
    }
    return this.prisma.dvirInspection.create({
      data: {
        companyId,
        assetId,
        unitNo: String(body.unitNo || ''),
        driverId: body.driverId ? String(body.driverId) : null,
        driverName: String(body.driverName || ''),
        inspectedAt,
        status: String(body.status || 'satisfactory'),
        defects: (body.defects as object) ?? [],
        remarks: String(body.remarks || ''),
      },
    });
  }

  async update(id: string, body: Record<string, unknown>) {
    await this.ensure(id);
    return this.prisma.dvirInspection.update({
      where: { id },
      data: {
        status: body.status !== undefined ? String(body.status) : undefined,
        defects: body.defects !== undefined ? (body.defects as object) : undefined,
        remarks: body.remarks !== undefined ? String(body.remarks) : undefined,
        inspectedAt:
          body.inspectedAt !== undefined ? String(body.inspectedAt) : undefined,
        driverId:
          body.driverId !== undefined
            ? body.driverId
              ? String(body.driverId)
              : null
            : undefined,
        driverName:
          body.driverName !== undefined ? String(body.driverName) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensure(id);
    return this.prisma.dvirInspection.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const row = await this.prisma.dvirInspection.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`DVIR ${id} not found`);
    return row;
  }
}
