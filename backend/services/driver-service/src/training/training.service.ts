import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
} from './dto/training.dto';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  findByDriver(driverId: string) {
    return this.prisma.driverTrainingRecord.findMany({
      where: { driverId },
      orderBy: { completedAt: 'desc' },
    });
  }

  async create(driverId: string, dto: CreateTrainingRecordDto) {
    await this.ensureDriver(driverId);
    return this.prisma.driverTrainingRecord.create({
      data: {
        companyId: dto.companyId,
        driverId,
        courseCode: dto.courseCode,
        courseName: dto.courseName ?? null,
        completedAt: dto.completedAt,
        expiryDate: dto.expiryDate ?? null,
        instructor: dto.instructor ?? null,
        certificateDocumentId: dto.certificateDocumentId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateTrainingRecordDto) {
    await this.ensureRecord(id);
    return this.prisma.driverTrainingRecord.update({
      where: { id },
      data: {
        courseCode: dto.courseCode,
        courseName: dto.courseName,
        completedAt: dto.completedAt,
        expiryDate: dto.expiryDate,
        instructor: dto.instructor,
        certificateDocumentId: dto.certificateDocumentId,
      },
    });
  }

  async remove(id: string) {
    await this.ensureRecord(id);
    await this.prisma.driverTrainingRecord.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureDriver(driverId: string) {
    const d = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) throw new NotFoundException(`Driver ${driverId} not found`);
    return d;
  }

  private async ensureRecord(id: string) {
    const r = await this.prisma.driverTrainingRecord.findUnique({
      where: { id },
    });
    if (!r) throw new NotFoundException(`Training record ${id} not found`);
    return r;
  }
}
