import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { UpsertDocumentDto } from './dto/upsert-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  findAll(params: { driverId?: string; companyId?: string }) {
    const { driverId, companyId } = params;
    return this.prisma.driverDocument.findMany({
      where: {
        ...(driverId ? { driverId } : {}),
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upsert(dto: UpsertDocumentDto) {
    const existing = await this.prisma.driverDocument.findFirst({
      where: { driverId: dto.driverId, type: dto.type },
    });

    const uploadedAt =
      dto.uploadedAt ?? new Date().toLocaleDateString('en-CA');

    let fileUrl = dto.fileUrl ?? existing?.fileUrl ?? null;
    let cloudinaryPublicId =
      dto.cloudinaryPublicId ?? existing?.cloudinaryPublicId ?? null;
    let fileData: string | null = null;

    if (dto.fileData?.startsWith('data:')) {
      if (this.files.isConfigured()) {
        const uploaded = await this.files.uploadDataUrl(dto.fileData, {
          folder: `tripsheet/${dto.companyId}/drivers/${dto.driverId}`,
          publicId: `${dto.type}-${Date.now()}`,
          fileName: dto.fileName,
        });
        // Replace previous Cloudinary asset on update
        if (existing?.cloudinaryPublicId) {
          await this.files.destroy(existing.cloudinaryPublicId);
        }
        fileUrl = uploaded.url;
        cloudinaryPublicId = uploaded.publicId;
        fileData = null; // never persist huge base64 when Cloudinary works
      } else {
        // Dev fallback without Cloudinary credentials
        fileData = dto.fileData;
      }
    } else if (dto.fileData) {
      fileData = dto.fileData;
    } else if (existing && !dto.fileUrl) {
      fileData = existing.fileData;
    }

    const data = {
      companyId: dto.companyId,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      fileType: dto.fileType,
      fileUrl,
      cloudinaryPublicId,
      fileData,
      uploadedAt,
      expiryDate: dto.expiryDate,
      notes: dto.notes,
      status: dto.status ?? 'uploaded',
    };

    if (existing) {
      return this.prisma.driverDocument.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.driverDocument.create({
      data: {
        driverId: dto.driverId,
        type: dto.type,
        ...data,
      },
    });
  }

  async remove(id: string) {
    const doc = await this.prisma.driverDocument.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    if (doc.cloudinaryPublicId) {
      await this.files.destroy(doc.cloudinaryPublicId);
    }
    await this.prisma.driverDocument.delete({ where: { id } });
    return { deleted: true };
  }
}
