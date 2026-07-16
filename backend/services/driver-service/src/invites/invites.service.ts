import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';

const MAX_INLINE_FILE_CHARS = 1_500_000; // ~1MB raw ≈ base64 data URL ceiling without Cloudinary

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly files: FilesService,
  ) {}

  findAll(companyId?: string) {
    return this.prisma.invite.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(dto: CreateInviteDto) {
    const token = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    return this.prisma.invite.create({
      data: {
        token,
        companyId: dto.companyId,
        status: 'pending',
        createdAt,
      },
    });
  }

  async findByToken(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.status !== 'pending') {
      throw new NotFoundException('Invite not found or no longer pending');
    }
    return invite;
  }

  async complete(token: string, dto: CompleteInviteDto) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException(`Invite ${token} not found`);
    }
    if (invite.status !== 'pending') {
      throw new BadRequestException(
        `This invite is already ${invite.status}. Ask your admin for a new link.`,
      );
    }

    if (!dto.profile?.name?.trim() || !dto.profile?.email?.trim()) {
      throw new BadRequestException('Name and email are required');
    }
    if (!dto.profile.password?.trim() && !dto.profile.userId) {
      throw new BadRequestException('Password is required to create login');
    }

    const email = dto.profile.email.toLowerCase().trim();

    let userId = dto.profile.userId;
    if (!userId && dto.profile.password) {
      userId = await this.tryCreateAuthUser({
        email,
        password: dto.profile.password,
        name: dto.profile.name.trim(),
        companyId: invite.companyId,
      });
      if (!userId) {
        throw new BadRequestException(
          'Could not create login account. Check auth-service is running and INTERNAL_API_KEY matches.',
        );
      }
    }

    let preparedDocs;
    try {
      preparedDocs = await this.prepareDocs(invite.companyId, dto.docs ?? []);
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`prepareDocs failed: ${String(err)}`);
      throw new BadRequestException(
        'Failed to process uploaded documents. Use smaller files (max 2MB) or configure Cloudinary.',
      );
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existingDriver = await tx.driver.findUnique({
          where: {
            companyId_email: { companyId: invite.companyId, email },
          },
        });
        if (existingDriver) {
          throw new ConflictException(
            'A driver with this email already exists for this company. Use a different email or ask admin to remove the old record.',
          );
        }

        const driver = await tx.driver.create({
          data: {
            companyId: invite.companyId,
            userId,
            name: dto.profile.name.trim(),
            email,
            phone: emptyToNull(dto.profile.phone),
            dob: emptyToNull(dto.profile.dob),
            licenseNo: emptyToNull(dto.profile.licenseNo),
            citizenship: emptyToNull(dto.profile.citizenship),
            address: emptyToNull(dto.profile.address),
            emergencyName: emptyToNull(dto.profile.emergencyName),
            emergencyPhone: emptyToNull(dto.profile.emergencyPhone),
            fastCard: emptyToNull(dto.profile.fastCard),
            notes: emptyToNull(dto.profile.notes),
            sin: emptyToNull(dto.profile.sin),
            active: true,
          },
        });

        if (preparedDocs.length) {
          await tx.driverDocument.createMany({
            data: preparedDocs.map((d) => ({
              driverId: driver.id,
              companyId: invite.companyId,
              type: d.type,
              fileName: d.fileName,
              fileSize: d.fileSize ?? null,
              fileType: d.fileType ?? null,
              fileData: d.fileData ?? null,
              fileUrl: d.fileUrl ?? null,
              cloudinaryPublicId: d.cloudinaryPublicId ?? null,
              uploadedAt:
                d.uploadedAt ?? new Date().toLocaleDateString('en-CA'),
              expiryDate: emptyToNull(d.expiryDate),
              notes: emptyToNull(d.notes),
              status: d.status ?? 'uploaded',
            })),
          });
        }

        if (dto.contract) {
          const c = dto.contract;
          const payload = toJsonValue({
            ...c,
            driverName: c.driverName ?? dto.profile.name,
            signedAt: c.signedAt ?? new Date().toISOString(),
          });

          await tx.contract.create({
            data: {
              driverId: driver.id,
              companyId: invite.companyId,
              driverName: c.driverName ?? dto.profile.name,
              companyName: emptyToNull(c.companyName),
              startDate: emptyToNull(c.startDate),
              payType: emptyToNull(c.payType),
              payRate: emptyToNull(c.payRate),
              payUnit: emptyToNull(c.payUnit),
              teamRate: emptyToNull(c.teamRate),
              detentionRate: emptyToNull(c.detentionRate),
              waitRate: emptyToNull(c.waitRate),
              fuelSurcharge: emptyToNull(c.fuelSurcharge),
              vacationPct: emptyToNull(c.vacationPct),
              trialDays: emptyToNull(c.trialDays),
              noticeDays: emptyToNull(c.noticeDays),
              benefits: emptyToNull(c.benefits),
              signedByDriver: Boolean(c.signedByDriver),
              signedByAdmin: Boolean(c.signedByAdmin),
              signedAt: c.signedAt ?? new Date().toISOString(),
              driverSignature: emptyToNull(c.driverSignature),
              adminSignature: emptyToNull(c.adminSignature),
              payload,
            },
          });

          if (c.signedByDriver || c.driverSignature) {
            await tx.driverDocument.create({
              data: {
                driverId: driver.id,
                companyId: invite.companyId,
                type: '__contract__',
                fileName: 'Employment Contract',
                uploadedAt: new Date().toLocaleDateString('en-CA'),
                status: 'uploaded',
                notes: 'Signed during onboarding',
              },
            });
          }
        }

        await tx.invite.update({
          where: { id: invite.id },
          data: {
            status: 'completed',
            driverId: driver.id,
            completedAt: new Date().toISOString(),
          },
        });

        return tx.driver.findUnique({
          where: { id: driver.id },
          include: {
            documents: {
              select: {
                id: true,
                type: true,
                fileName: true,
                fileUrl: true,
                status: true,
                uploadedAt: true,
                // omit fileData from response (can be huge)
              },
            },
            contracts: true,
          },
        });
      });

      return { driver: result };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof ConflictException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error(`Invite complete failed: ${String(err)}`);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException(
            'Driver or document already exists for this email. Use a new invite and unique email.',
          );
        }
        throw new BadRequestException(`Database error: ${err.message}`);
      }
      if (err instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException(
          'Invalid onboarding data. Check documents and try again with smaller files.',
        );
      }
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Failed to complete onboarding',
      );
    }
  }

  private async prepareDocs(
    companyId: string,
    docs: NonNullable<CompleteInviteDto['docs']>,
  ) {
    const out: Array<{
      type: string;
      fileName: string;
      fileSize?: number | null;
      fileType?: string | null;
      fileData?: string | null;
      fileUrl?: string | null;
      cloudinaryPublicId?: string | null;
      uploadedAt?: string;
      expiryDate?: string | null;
      notes?: string | null;
      status?: string;
    }> = [];

    for (const d of docs) {
      if (!d.type?.trim() || !d.fileName?.trim()) {
        throw new BadRequestException('Each document needs type and fileName');
      }

      let fileData: string | null = d.fileData?.trim() ? d.fileData : null;
      let fileUrl: string | null = null;
      let cloudinaryPublicId: string | null = null;

      if (fileData?.startsWith('data:') && this.files.isConfigured()) {
        try {
          const uploaded = await this.files.uploadDataUrl(fileData, {
            folder: `tripsheet/${companyId}/onboarding`,
            publicId: `${d.type}-${Date.now()}-${randomBytes(3).toString('hex')}`,
            fileName: d.fileName,
          });
          fileUrl = uploaded.url;
          cloudinaryPublicId = uploaded.publicId;
          fileData = null;
        } catch (err) {
          this.logger.warn(
            `Cloudinary upload failed for ${d.type}: ${String(err)}`,
          );
          if (fileData && fileData.length > MAX_INLINE_FILE_CHARS) {
            throw new BadRequestException(
              `Document "${d.fileName}" is too large to store without Cloudinary. Use a file under 2MB or fix Cloudinary credentials.`,
            );
          }
        }
      } else if (fileData && fileData.length > MAX_INLINE_FILE_CHARS) {
        throw new BadRequestException(
          `Document "${d.fileName}" is too large. Max ~1MB without Cloudinary, or configure Cloudinary.`,
        );
      }

      const sizeRaw = d.fileSize as unknown;
      const fileSize =
        typeof sizeRaw === 'number' && Number.isFinite(sizeRaw)
          ? Math.round(sizeRaw)
          : typeof sizeRaw === 'string' && /^\d+$/.test(sizeRaw)
            ? parseInt(sizeRaw, 10)
            : null;

      out.push({
        type: d.type,
        fileName: d.fileName,
        fileSize,
        fileType: emptyToNull(d.fileType),
        fileData,
        fileUrl,
        cloudinaryPublicId,
        uploadedAt: d.uploadedAt,
        expiryDate: emptyToNull(d.expiryDate),
        notes: emptyToNull(d.notes),
        status: d.status,
      });
    }

    return out;
  }

  private async tryCreateAuthUser(input: {
    email: string;
    password: string;
    name: string;
    companyId: string;
  }): Promise<string | undefined> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL');
    if (!baseUrl) {
      this.logger.error('AUTH_SERVICE_URL not set');
      return undefined;
    }

    const apiKey =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/internal/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': apiKey,
        },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          name: input.name,
          role: 'driver',
          companyId: input.companyId,
        }),
      });
      if (!res.ok) {
        this.logger.warn(
          `auth-service internal create user failed: ${res.status} ${await res.text()}`,
        );
        return undefined;
      }
      const body = (await res.json()) as { id?: string };
      return body.id;
    } catch (err) {
      this.logger.warn(
        `auth-service unreachable while completing invite: ${String(err)}`,
      );
      return undefined;
    }
  }
}

function emptyToNull(v?: string | null): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
