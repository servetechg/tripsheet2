import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { QualificationsService } from '../qualifications/qualifications.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';
import {
  assertPermission,
  getTenantStore,
  tenantAls,
  TenantConnectionCache,
  TenantStore,
} from '@tripsheet/tenant-runtime';
import { Invite } from '@prisma/client';

const MAX_INLINE_FILE_CHARS = 1_500_000; // ~1MB raw ≈ base64 data URL ceiling without Cloudinary

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);
  private tenantRoutingCache: { at: number; ids: string[] } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly files: FilesService,
    private readonly qualifications: QualificationsService,
    private readonly tenants: TenantConnectionCache,
  ) {}

  findAll(companyId?: string) {
    return this.prisma.invite.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { updatedAt: 'desc' },
    }).then(async (rows) => {
      const out: typeof rows = [];
      for (const row of rows) {
        out.push(await this.refreshExpiry(row));
      }
      return out;
    });
  }

  async create(dto: CreateInviteDto) {
    const kind = dto.kind === 'staff' ? 'staff' : 'driver';
    if (kind === 'staff') {
      assertPermission('users.create');
      assertPermission('users.assign_role');
      if (!dto.role || dto.role === 'driver' || dto.role === 'superadmin') {
        throw new BadRequestException('Staff invite requires a company role');
      }
      if (!dto.email?.trim()) {
        throw new BadRequestException('Staff invite requires an email');
      }
    } else {
      assertPermission('drivers.invite');
    }

    const ttlDays = await this.fetchInviteTtlDays(dto.companyId);
    const token = randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const invite = await this.prisma.invite.create({
      data: {
        token,
        companyId: dto.companyId,
        status: 'pending',
        kind,
        role: kind === 'staff' ? dto.role! : 'driver',
        email: dto.email?.trim().toLowerCase() || null,
        name: dto.name?.trim() || null,
        createdAt,
        expiresAt,
      },
    });

    if (invite.email) {
      void this.queueInviteEmail(invite);
    }
    return invite;
  }

  async findByToken(token: string) {
    const located = await this.locateInvite(token);
    if (!located) {
      throw new NotFoundException('Invite not found or no longer pending');
    }
    return tenantAls.run(located.store, async () => {
      const invite = await this.prisma.invite.findUnique({ where: { token } });
      if (!invite) {
        throw new NotFoundException('Invite not found or no longer pending');
      }
      const fresh = await this.refreshExpiry(invite);
      if (fresh.status !== 'pending') {
        throw new NotFoundException('Invite not found or no longer pending');
      }
      const passwordPolicy = await this.fetchPasswordPolicy(invite.companyId);
      return { ...fresh, passwordPolicy };
    });
  }

  async complete(token: string, dto: CompleteInviteDto) {
    const located = await this.locateInvite(token);
    if (!located) {
      throw new NotFoundException(`Invite ${token} not found`);
    }
    return tenantAls.run(located.store, () =>
      this.completeInContext(token, dto),
    );
  }

  private async completeInContext(token: string, dto: CompleteInviteDto) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) {
      throw new NotFoundException(`Invite ${token} not found`);
    }
    const fresh = await this.refreshExpiry(invite);
    if (fresh.status !== 'pending') {
      throw new BadRequestException(
        `This invite is already ${fresh.status}. Ask your admin for a new link.`,
      );
    }

    if (invite.kind === 'staff') {
      return this.completeStaff(invite, dto);
    }

    if (!dto.profile?.name?.trim() || !dto.profile?.email?.trim()) {
      throw new BadRequestException('Name and email are required');
    }
    if (!dto.profile.password?.trim() && !dto.profile.userId) {
      throw new BadRequestException('Password is required to create login');
    }

    const email = dto.profile.email.toLowerCase().trim();

    await this.ensureTenantDriverSchema(invite.companyId);

    let userId = dto.profile.userId;
    if (!userId && dto.profile.password) {
      userId = await this.tryCreateAuthUser({
        email,
        password: dto.profile.password,
        name: dto.profile.name.trim(),
        companyId: invite.companyId,
        role: 'driver',
        inviteCompletion: true,
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
            lifecycleStatus: 'pending_review',
            active: false,
            employmentStatus: 'active',
            driverType: emptyToNull((dto.profile as any).driverType) ?? 'company',
            employeeNumber: emptyToNull((dto.profile as any).employeeNumber),
            hireDate: emptyToNull((dto.profile as any).hireDate),
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
                expiryDate: true,
              },
            },
            contracts: true,
          },
        });
      });

      void this.queueInviteAcceptedNotify({
        companyId: invite.companyId,
        email,
        role: 'driver',
        kind: 'driver',
      });

      if (result?.id && result.documents?.length) {
        await this.qualifications.seedFromOnboarding(
          result.id,
          invite.companyId,
          result.documents.map((d) => ({
            id: d.id,
            type: d.type,
            expiryDate: d.expiryDate,
          })),
        );
        await this.qualifications.syncLicenseFromProfile({
          driverId: result.id,
          companyId: invite.companyId,
          licenseNo: dto.profile.licenseNo,
        });
        if (dto.profile.fastCard) {
          await this.qualifications.syncFastFromProfile({
            driverId: result.id,
            companyId: invite.companyId,
            fastCard: dto.profile.fastCard,
          });
        }
      }

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
        if (err.code === 'P2022') {
          throw new BadRequestException(
            'Driver database schema is updating. Wait a moment and submit again.',
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

  private async completeStaff(
    invite: {
      id: string;
      token: string;
      companyId: string;
      role: string;
      email: string | null;
      name: string | null;
    },
    dto: CompleteInviteDto,
  ) {
    if (!dto.profile?.name?.trim() || !dto.profile?.email?.trim()) {
      throw new BadRequestException('Name and email are required');
    }
    if (!dto.profile.password?.trim()) {
      throw new BadRequestException('Password is required to create login');
    }
    const email = dto.profile.email.toLowerCase().trim();
    if (invite.email && invite.email !== email) {
      throw new BadRequestException('Use the email this invite was sent to');
    }

    const userId = await this.tryCreateAuthUser({
      email,
      password: dto.profile.password,
      name: dto.profile.name.trim(),
      companyId: invite.companyId,
      role: invite.role || 'dispatcher',
      inviteCompletion: true,
    });
    if (!userId) {
      throw new BadRequestException(
        'Could not create login account. Check auth-service is running.',
      );
    }
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: {
        status: 'completed',
        completedAt: new Date().toISOString(),
        email,
        name: dto.profile.name.trim(),
      },
    });
    void this.queueInviteAcceptedNotify({
      companyId: invite.companyId,
      email,
      role: invite.role,
      kind: 'staff',
    });
    return { ok: true, userId, role: invite.role, kind: 'staff' };
  }

  async revoke(id: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === 'completed') {
      throw new BadRequestException('Completed invites cannot be revoked');
    }
    if (invite.kind === 'driver') {
      assertPermission('drivers.invite');
    } else {
      assertPermission('users.create');
      assertPermission('users.assign_role');
    }
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'revoked' },
    });
  }

  async regenerate(id: string) {
    const existing = await this.prisma.invite.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Invite not found');
    if (existing.status === 'completed') {
      throw new BadRequestException('Completed invites cannot be regenerated');
    }
    if (existing.kind === 'staff') {
      assertPermission('users.create');
      assertPermission('users.assign_role');
    } else {
      assertPermission('drivers.invite');
    }
    if (existing.status === 'pending') {
      await this.prisma.invite.update({
        where: { id },
        data: { status: 'revoked' },
      });
    }
    return this.create({
      companyId: existing.companyId,
      kind: existing.kind === 'staff' ? 'staff' : 'driver',
      role: existing.role,
      email: existing.email || undefined,
      name: existing.name || undefined,
    });
  }

  private async locateInvite(
    token: string,
  ): Promise<{ invite: Invite; store: TenantStore } | null> {
    const current = getTenantStore();
    if (current?.useTenantDb) {
      const invite = await this.prisma.invite.findUnique({ where: { token } });
      return invite ? { invite, store: current } : null;
    }

    const sharedInvite = await this.prisma.invite.findUnique({
      where: { token },
    });
    if (sharedInvite) {
      const conn = await this.tenants.resolve(sharedInvite.companyId);
      if (!conn?.connectionUrl || conn.status !== 'active') return null;
      const store: TenantStore = {
        companyId: sharedInvite.companyId,
        tenantKey: conn.tenantKey,
        dbName: conn.dbName,
        tenantStatus: conn.status,
        routingMode: 'tenant',
        connectionUrl: conn.connectionUrl,
        useTenantDb: true,
      };
      const invite = await tenantAls.run(store, () =>
        this.prisma.invite.findUnique({ where: { token } }),
      );
      return invite ? { invite, store } : null;
    }

    for (const companyId of await this.tenantRoutedCompanyIds()) {
      const conn = await this.tenants.resolve(companyId);
      if (!conn?.connectionUrl || conn.routingMode !== 'tenant') continue;
      const store: TenantStore = {
        companyId,
        tenantKey: conn.tenantKey,
        dbName: conn.dbName,
        tenantStatus: conn.status,
        routingMode: 'tenant',
        connectionUrl: conn.connectionUrl,
        useTenantDb: true,
      };
      const invite = await tenantAls.run(store, () =>
        this.prisma.invite.findUnique({ where: { token } }),
      );
      if (invite) return { invite, store };
    }
    return null;
  }

  private async tenantRoutedCompanyIds(): Promise<string[]> {
    const ttlMs = 60_000;
    if (
      this.tenantRoutingCache &&
      Date.now() - this.tenantRoutingCache.at < ttlMs
    ) {
      return this.tenantRoutingCache.ids;
    }
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/routing-tenant`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) {
        this.logger.warn(`tenant routing list failed: HTTP ${res.status}`);
        return [];
      }
      const rows = (await res.json()) as Array<{ companyId?: string }>;
      const ids = rows.map((r) => String(r.companyId)).filter(Boolean);
      this.tenantRoutingCache = { at: Date.now(), ids };
      return ids;
    } catch (e) {
      this.logger.warn(`tenant routing list error: ${String(e)}`);
      return [];
    }
  }

  private async refreshExpiry<
    T extends { id: string; status: string; expiresAt: string | null },
  >(invite: T): Promise<T> {
    if (invite.status !== 'pending') return invite;
    if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now()) {
      const updated = await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      return updated as unknown as T;
    }
    return invite;
  }

  private async fetchInviteTtlDays(companyId: string): Promise<number> {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/security-policy`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) return 7;
      const row = (await res.json()) as { inviteTtlDays?: number };
      const n = Number(row.inviteTtlDays);
      if (!Number.isFinite(n)) return 7;
      return Math.min(90, Math.max(1, Math.trunc(n)));
    } catch {
      return 7;
    }
  }

  private async queueInviteEmail(invite: {
    token: string;
    companyId: string;
    email: string | null;
    name: string | null;
    role: string;
  }) {
    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    const origin =
      this.config.get<string>('INVITE_PUBLIC_ORIGIN') ||
      'http://localhost:5173';
    if (!notifyUrl || !invite.email) return;
    const link = `${origin.replace(/\/$/, '')}/invite?invite=${encodeURIComponent(invite.token)}`;
    try {
      await fetch(`${notifyUrl.replace(/\/$/, '')}/notifications/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: invite.companyId,
          channel: 'email',
          to: invite.email,
          body: `You are invited as ${invite.role}. Set your password: ${link}`,
          status: 'queued',
          meta: { type: 'staff_invite', role: invite.role, token: invite.token },
        }),
      });
    } catch (e) {
      this.logger.warn(`invite email log failed: ${String(e)}`);
    }
  }

  private async queueInviteAcceptedNotify(input: {
    companyId: string;
    email: string;
    role: string;
    kind: string;
  }) {
    const authUrl =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      await fetch(`${authUrl.replace(/\/$/, '')}/internal/security-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': key,
        },
        body: JSON.stringify({
          type: 'security.invite_accepted',
          to: input.email,
          companyId: input.companyId,
          detail: `Role: ${input.role} (${input.kind}).`,
        }),
      });
    } catch (e) {
      this.logger.warn(`invite accepted security notify failed: ${String(e)}`);
    }
  }

  private async fetchPasswordPolicy(companyId: string) {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/security-policy`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) return null;
      const row = (await res.json()) as {
        passwordMinLength?: number;
        passwordComplexity?: boolean;
      };
      const complexity = Boolean(row.passwordComplexity);
      const minRaw = Number(row.passwordMinLength) || 8;
      const minLength = complexity ? Math.max(minRaw, 12) : Math.max(minRaw, 4);
      return {
        minLength,
        complexity,
        hint: complexity
          ? `At least ${minLength} characters, with upper, lower, a number, and a special character (not your name or email)`
          : `At least ${minLength} characters`,
      };
    } catch (e) {
      this.logger.warn(`password policy for invite failed: ${String(e)}`);
      return null;
    }
  }

  /** Apply Chapter 6 driver columns on tenant DB before onboarding writes. */
  private async ensureTenantDriverSchema(companyId: string) {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/ensure-driver-schema`,
        {
          method: 'POST',
          headers: { 'x-internal-api-key': key },
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.warn(
          `ensure-driver-schema failed for ${companyId}: HTTP ${res.status} ${detail.slice(0, 200)}`,
        );
        if (res.status < 500) {
          throw new BadRequestException(
            'Driver database schema is updating. Wait a moment and submit again.',
          );
        }
        return;
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(`ensure-driver-schema error: ${String(e)}`);
    }
  }

  private async tryCreateAuthUser(input: {
    email: string;
    password: string;
    name: string;
    companyId: string;
    role?: string;
    inviteCompletion?: boolean;
  }): Promise<string | undefined> {
    const baseUrl =
      this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';

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
          role: input.role || 'driver',
          companyId: input.companyId,
          inviteCompletion: input.inviteCompletion ?? true,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = 'Could not create login account';
        try {
          const parsed = JSON.parse(text) as { message?: string | string[] };
          const m = parsed.message;
          message = Array.isArray(m) ? m.join(', ') : m || message;
        } catch {
          /* keep default */
        }
        this.logger.warn(
          `auth-service internal create user failed: ${res.status} ${text}`,
        );
        if (res.status === 400) {
          throw new BadRequestException(message);
        }
        if (res.status === 401) {
          throw new BadRequestException(
            'Could not create login account. INTERNAL_API_KEY mismatch between driver-service and auth-service.',
          );
        }
        throw new BadRequestException(
          res.status >= 500
            ? 'Auth service is unavailable. Ensure auth-service is running on port 3001.'
            : message,
        );
      }
      const body = (await res.json()) as { id?: string };
      return body.id;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.warn(
        `auth-service unreachable while completing invite: ${String(err)}`,
      );
      throw new BadRequestException(
        'Auth service is unreachable. Start the backend (npm run start:dev) and try again.',
      );
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
