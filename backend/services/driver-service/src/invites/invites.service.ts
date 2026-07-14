import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
      throw new BadRequestException(`Invite is ${invite.status}`);
    }

    const email = dto.profile.email.toLowerCase();
    let userId = dto.profile.userId;

    // Optional: try auth-service if password provided.
    // Preferred flow: gateway/frontend creates auth user first, then completes invite with userId.
    if (!userId && dto.profile.password) {
      userId = await this.tryCreateAuthUser({
        email,
        password: dto.profile.password,
        name: dto.profile.name,
        companyId: invite.companyId,
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const driver = await tx.driver.create({
        data: {
          companyId: invite.companyId,
          userId,
          name: dto.profile.name,
          email,
          phone: dto.profile.phone,
          dob: dto.profile.dob,
          licenseNo: dto.profile.licenseNo,
          citizenship: dto.profile.citizenship,
          address: dto.profile.address,
          emergencyName: dto.profile.emergencyName,
          emergencyPhone: dto.profile.emergencyPhone,
          fastCard: dto.profile.fastCard,
          notes: dto.profile.notes,
          sin: dto.profile.sin,
          active: true,
        },
      });

      if (dto.docs?.length) {
        await tx.driverDocument.createMany({
          data: dto.docs.map((d) => ({
            driverId: driver.id,
            companyId: invite.companyId,
            type: d.type,
            fileName: d.fileName,
            fileSize: d.fileSize,
            fileType: d.fileType,
            fileData: d.fileData,
            uploadedAt:
              d.uploadedAt ?? new Date().toLocaleDateString('en-CA'),
            expiryDate: d.expiryDate,
            notes: d.notes,
            status: d.status ?? 'uploaded',
          })),
        });
      }

      if (dto.contract) {
        const c = dto.contract;
        const payload =
          c.payload === undefined
            ? (c as unknown as Prisma.InputJsonValue)
            : (c.payload as Prisma.InputJsonValue);

        await tx.contract.create({
          data: {
            driverId: driver.id,
            companyId: invite.companyId,
            driverName: c.driverName ?? dto.profile.name,
            companyName: c.companyName,
            startDate: c.startDate,
            payType: c.payType,
            payRate: c.payRate,
            payUnit: c.payUnit,
            teamRate: c.teamRate,
            detentionRate: c.detentionRate,
            waitRate: c.waitRate,
            fuelSurcharge: c.fuelSurcharge,
            vacationPct: c.vacationPct,
            trialDays: c.trialDays,
            noticeDays: c.noticeDays,
            benefits: c.benefits,
            signedByDriver: c.signedByDriver ?? false,
            signedByAdmin: c.signedByAdmin ?? false,
            signedAt: c.signedAt,
            driverSignature: c.driverSignature,
            adminSignature: c.adminSignature,
            payload,
          },
        });

        // Mirror signed contract into documents as __contract__ (frontend convention)
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
        include: { documents: true, contracts: true },
      });
    });

    return { driver: result };
  }

  /**
   * Best-effort auth user creation. Prefer gateway/frontend creating the
   * auth user via POST /auth/users, then linking with profile.userId.
   */
  private async tryCreateAuthUser(input: {
    email: string;
    password: string;
    name: string;
    companyId: string;
  }): Promise<string | undefined> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL');
    if (!baseUrl) {
      this.logger.debug(
        'AUTH_SERVICE_URL not set — skipping auth user create; link userId from gateway/frontend',
      );
      return undefined;
    }

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          `auth-service create user failed: ${res.status} ${await res.text()}`,
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
