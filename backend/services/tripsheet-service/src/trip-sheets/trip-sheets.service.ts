import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  nextSequenceFromValues,
  SEQUENCE_PREFIX,
} from '@tripsheet/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripSheetDto } from './dto/create-trip-sheet.dto';
import { UpdateTripSheetDto } from './dto/update-trip-sheet.dto';

@Injectable()
export class TripSheetsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string, driverId?: string) {
    return this.prisma.tripSheet.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(driverId ? { driverId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.ensureExists(id);
  }

  async create(dto: CreateTripSheetDto) {
    const trips = await this.assignSheetLegTripNumbers(
      dto.companyId,
      dto.trips ?? [],
    );
    this.validateSheetPayload(dto.header, trips, dto.expenses);
    return this.prisma.tripSheet.create({
      data: {
        companyId: dto.companyId,
        driverId: dto.driverId,
        header: dto.header as Prisma.InputJsonValue,
        trips: trips as Prisma.InputJsonValue,
        expenses: (dto.expenses ?? []) as Prisma.InputJsonValue,
        notes: dto.notes ?? '',
      },
    });
  }

  async update(id: string, dto: UpdateTripSheetDto) {
    const existing = await this.ensureExists(id);
    let trips = dto.trips;
    if (trips !== undefined) {
      trips = await this.assignSheetLegTripNumbers(existing.companyId, trips);
    }
    if (
      dto.header !== undefined ||
      trips !== undefined ||
      dto.expenses !== undefined
    ) {
      this.validateSheetPayload(dto.header, trips, dto.expenses);
    }
    return this.prisma.tripSheet.update({
      where: { id },
      data: {
        driverId: dto.driverId,
        header:
          dto.header !== undefined
            ? (dto.header as Prisma.InputJsonValue)
            : undefined,
        trips:
          trips !== undefined
            ? (trips as Prisma.InputJsonValue)
            : undefined,
        expenses:
          dto.expenses !== undefined
            ? (dto.expenses as Prisma.InputJsonValue)
            : undefined,
        notes: dto.notes,
      },
    });
  }

  private validateSheetPayload(
    header?: Record<string, unknown>,
    trips?: unknown[],
    expenses?: unknown[],
  ) {
    if (header !== undefined) {
      if (!header || typeof header !== 'object') {
        throw new BadRequestException('Trip sheet header must be an object');
      }
      const h = header as Record<string, unknown>;
      if (!h.truckNo || !String(h.truckNo).trim()) {
        throw new BadRequestException('Truck Unit No. is required');
      }
      if (!h.startDate || !String(h.startDate).trim()) {
        throw new BadRequestException('Start Date is required');
      }
      if (!h.endDate || !String(h.endDate).trim()) {
        throw new BadRequestException('End Date is required');
      }
      if (!h.driver1 || !String(h.driver1).trim()) {
        throw new BadRequestException('Driver Name 1 is required');
      }
    }

    if (trips !== undefined) {
      if (!Array.isArray(trips) || trips.length === 0) {
        throw new BadRequestException('At least one trip leg is required');
      }
      for (let i = 0; i < trips.length; i++) {
        const leg = trips[i] as Record<string, unknown>;
        if (!leg || typeof leg !== 'object') {
          throw new BadRequestException(`Trip leg #${i + 1} is invalid`);
        }
        if (!leg.trailerNo || !String(leg.trailerNo).trim()) {
          throw new BadRequestException(
            `Trip leg #${i + 1} requires a trailer number`,
          );
        }
        if (!leg.pickupDate || !String(leg.pickupDate).trim()) {
          throw new BadRequestException(
            `Trip leg #${i + 1} requires a pickup date`,
          );
        }
        if (!leg.dropDate || !String(leg.dropDate).trim()) {
          throw new BadRequestException(
            `Trip leg #${i + 1} requires a drop date`,
          );
        }
        if (!leg.from || !String(leg.from).trim()) {
          throw new BadRequestException(
            `Trip leg #${i + 1} requires an origin (from)`,
          );
        }
        if (!leg.to || !String(leg.to).trim()) {
          throw new BadRequestException(
            `Trip leg #${i + 1} requires a destination (to)`,
          );
        }
      }
    }

    if (expenses !== undefined) {
      if (!Array.isArray(expenses)) {
        throw new BadRequestException('Expenses must be an array');
      }
      for (let i = 0; i < expenses.length; i++) {
        const exp = expenses[i] as Record<string, unknown>;
        if (!exp || typeof exp !== 'object') {
          throw new BadRequestException(`Expense #${i + 1} is invalid`);
        }
        const hasData = Boolean(
          (exp.description && String(exp.description).trim()) ||
            (exp.receiptNo && String(exp.receiptNo).trim()) ||
            (exp.amount !== '' &&
              exp.amount !== undefined &&
              exp.amount !== null),
        );
        if (hasData) {
          const amt = Number(exp.amount);
          if (isNaN(amt) || amt < 0.01) {
            throw new BadRequestException(
              `Expense #${i + 1} amount must be at least $0.01 (cannot be negative or zero, got ${exp.amount})`,
            );
          }
          if (amt > 50000) {
            throw new BadRequestException(
              `Expense #${i + 1} amount cannot exceed $50,000.00 (got ${exp.amount})`,
            );
          }
          if (!exp.description || !String(exp.description).trim()) {
            throw new BadRequestException(
              `Expense #${i + 1} requires a description`,
            );
          }
        }
      }
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.tripSheet.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async assignSheetLegTripNumbers(
    companyId: string,
    trips: unknown[],
  ): Promise<unknown[]> {
    if (!Array.isArray(trips)) return trips;
    const known = await this.collectSheetLegTripNumbers(companyId);
    const prefix = SEQUENCE_PREFIX.sheetLeg;
    let next = nextSequenceFromValues(known, prefix);
    return trips.map((raw) => {
      if (!raw || typeof raw !== 'object') return raw;
      const leg = { ...(raw as Record<string, unknown>) };
      const existing = leg.tripNo ? String(leg.tripNo).trim() : '';
      if (existing) {
        known.push(existing);
        return leg;
      }
      leg.tripNo = next;
      known.push(next);
      next = nextSequenceFromValues(known, prefix);
      return leg;
    });
  }

  private async collectSheetLegTripNumbers(
    companyId: string,
  ): Promise<string[]> {
    const sheets = await this.prisma.tripSheet.findMany({
      where: { companyId },
      select: { trips: true },
    });
    const out: string[] = [];
    for (const sheet of sheets) {
      if (!Array.isArray(sheet.trips)) continue;
      for (const raw of sheet.trips) {
        if (!raw || typeof raw !== 'object') continue;
        const tripNo = (raw as Record<string, unknown>).tripNo;
        if (tripNo && String(tripNo).trim()) {
          out.push(String(tripNo).trim());
        }
      }
    }
    return out;
  }

  private async ensureExists(id: string) {
    const sheet = await this.prisma.tripSheet.findUnique({ where: { id } });
    if (!sheet) {
      throw new NotFoundException(`Trip sheet ${id} not found`);
    }
    return sheet;
  }
}
