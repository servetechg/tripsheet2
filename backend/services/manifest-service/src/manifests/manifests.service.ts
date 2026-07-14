import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManifestDto } from './dto/create-manifest.dto';
import { UpdateManifestDto } from './dto/update-manifest.dto';
import { RejectManifestDto } from './dto/reject-manifest.dto';

type ManifestStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

const TRANSITIONS: Record<ManifestStatus, readonly ManifestStatus[]> = {
  draft: ['submitted'],
  submitted: ['accepted', 'rejected', 'cancelled'],
  accepted: ['cancelled'],
  rejected: ['submitted', 'cancelled'],
  cancelled: [],
};

@Injectable()
export class ManifestsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId?: string) {
    return this.prisma.manifest.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.ensureExists(id);
  }

  create(dto: CreateManifestDto) {
    return this.prisma.manifest.create({
      data: {
        companyId: dto.companyId,
        type: dto.type,
        status: 'draft',
        crn: dto.crn,
        loadId: dto.loadId,
        driverId: dto.driverId,
        truckId: dto.truckId,
        trailerId: dto.trailerId,
        portOfEntry: dto.portOfEntry,
        estimatedArrival: dto.estimatedArrival,
        shipments: (dto.shipments ?? []) as Prisma.InputJsonValue,
        formData: dto.formData as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(id: string, dto: UpdateManifestDto) {
    const manifest = await this.ensureExists(id);
    if (manifest.status === 'cancelled') {
      throw new BadRequestException('Cannot update a cancelled manifest');
    }
    if (manifest.status === 'accepted') {
      throw new BadRequestException('Cannot update an accepted manifest');
    }

    return this.prisma.manifest.update({
      where: { id },
      data: {
        type: dto.type,
        crn: dto.crn,
        loadId: dto.loadId,
        driverId: dto.driverId,
        truckId: dto.truckId,
        trailerId: dto.trailerId,
        portOfEntry: dto.portOfEntry,
        estimatedArrival: dto.estimatedArrival,
        shipments:
          dto.shipments !== undefined
            ? (dto.shipments as Prisma.InputJsonValue)
            : undefined,
        formData:
          dto.formData !== undefined
            ? (dto.formData as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  async remove(id: string) {
    const manifest = await this.ensureExists(id);
    if (manifest.status !== 'draft') {
      throw new BadRequestException('Only draft manifests can be deleted');
    }
    await this.prisma.manifest.delete({ where: { id } });
    return { deleted: true, id };
  }

  async submit(id: string) {
    return this.transition(id, 'submitted', {
      submittedAt: new Date().toISOString(),
      rejectionReason: null,
      rejectedAt: null,
    });
  }

  async accept(id: string) {
    return this.transition(id, 'accepted', {
      acceptedAt: new Date().toISOString(),
    });
  }

  async reject(id: string, dto: RejectManifestDto) {
    return this.transition(id, 'rejected', {
      rejectionReason: dto.reason ?? 'Rejected',
      rejectedAt: new Date().toISOString(),
    });
  }

  async cancel(id: string) {
    return this.transition(id, 'cancelled');
  }

  private async transition(
    id: string,
    to: ManifestStatus,
    extra: Prisma.ManifestUpdateInput = {},
  ) {
    const manifest = await this.ensureExists(id);
    const from = manifest.status as ManifestStatus;
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException(
        `Cannot transition manifest from "${from}" to "${to}"`,
      );
    }
    return this.prisma.manifest.update({
      where: { id },
      data: { status: to, ...extra },
    });
  }

  private async ensureExists(id: string) {
    const manifest = await this.prisma.manifest.findUnique({ where: { id } });
    if (!manifest) {
      throw new NotFoundException(`Manifest ${id} not found`);
    }
    return manifest;
  }
}
