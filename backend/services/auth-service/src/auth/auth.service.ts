import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RbacService } from '../rbac/rbac.service';
import { normalizeRoleCode } from '../rbac/rbac.catalog';
import {
  PLATFORM_PASSWORD_POLICY,
  assertPasswordMeetsPolicy,
  policyFromRow,
  publicPasswordPolicy,
  type PasswordPolicy,
} from './password.policy';
import type { JwtActor } from '../rbac/actor';

type RequestMeta = { ip?: string; userAgent?: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta = {}) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      await this.recordLogin({
        email,
        success: false,
        reason: 'unknown_user',
        meta,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const policy = await this.resolvePasswordPolicy(user.companyId);
    const lockedMs = user.lockedUntil?.getTime() || 0;
    if (lockedMs > Date.now()) {
      const mins = Math.max(1, Math.ceil((lockedMs - Date.now()) / 60000));
      await this.recordLogin({
        user,
        success: false,
        reason: 'locked',
        meta,
      });
      throw new UnauthorizedException(
        `Account locked. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      const fails = user.failedLoginCount + 1;
      const lock =
        fails >= policy.lockoutThreshold
          ? new Date(Date.now() + policy.lockoutMinutes * 60_000)
          : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: fails,
          lockedUntil: lock,
        },
      });
      await this.recordLogin({
        user,
        success: false,
        reason: lock ? 'lockout' : 'bad_password',
        meta,
      });
      if (lock) {
        await this.auditAuth(user.companyId, {
          actorId: user.id,
          actorName: user.email,
          action: 'login.lockout',
          entityId: user.id,
          meta: { threshold: policy.lockoutThreshold },
        });
        throw new UnauthorizedException(
          `Account locked. Try again in ${policy.lockoutMinutes} minutes.`,
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    const unlocked = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    await this.recordLogin({ user: unlocked, success: true, reason: 'ok', meta });
    return this.issueSession(unlocked, policy);
  }

  async getSessionSnapshot(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true, lockedUntil: true },
    });
    if (!user) return { tokenVersion: -1, lockedUntil: null };
    return {
      tokenVersion: user.tokenVersion,
      lockedUntil: user.lockedUntil?.toISOString() || null,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await this.hashNewPassword(
      dto.newPassword,
      user.companyId,
    );
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    const policy = await this.resolvePasswordPolicy(updated.companyId);
    return this.issueSession(updated, policy);
  }

  async logoutAllSessions(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.auditAuth(user.companyId, {
      actorId: user.id,
      actorName: user.email,
      action: 'session.revoked',
      entityId: user.id,
    });
    return { ok: true };
  }

  async listLoginHistory(
    actor: JwtActor | undefined,
    opts: { userId?: string; limit?: number },
  ) {
    if (!actor?.sub) throw new UnauthorizedException('Not authenticated');
    const limit = Math.min(200, Math.max(1, opts.limit || 50));
    const targetId = opts.userId || actor.sub;
    const privileged =
      actor.role === 'superadmin' ||
      actor.role === 'company_owner' ||
      actor.role === 'company_admin' ||
      Boolean(actor.permissions?.includes('users.view')) ||
      Boolean(actor.permissions?.includes('admin.audit')) ||
      Boolean(actor.permissions?.includes('admin.security'));

    if (targetId !== actor.sub && !privileged) {
      throw new ForbiddenException('Cannot view another user\'s login history');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');
    if (
      actor.role !== 'superadmin' &&
      actor.companyId &&
      target.companyId &&
      actor.companyId !== target.companyId
    ) {
      throw new ForbiddenException('Cannot access another company');
    }

    return this.prisma.loginEvent.findMany({
      where: { userId: targetId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        success: true,
        reason: true,
        ip: true,
        userAgent: true,
        createdAt: true,
      },
    });
  }

  async listCompanyLoginHistory(
    actor: JwtActor | undefined,
    opts: { limit?: number; companyId?: string } = {},
  ) {
    if (!actor?.sub) throw new UnauthorizedException('Not authenticated');
    const privileged =
      actor.role === 'superadmin' ||
      actor.role === 'company_owner' ||
      actor.role === 'company_admin' ||
      Boolean(actor.permissions?.includes('admin.security')) ||
      Boolean(actor.permissions?.includes('admin.audit'));
    if (!privileged) {
      throw new ForbiddenException('Missing permission: admin.security');
    }
    const companyId =
      actor.role === 'superadmin'
        ? opts.companyId
        : actor.companyId || undefined;
    if (!companyId) {
      throw new BadRequestException('No company on session');
    }
    return this.prisma.loginEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, opts.limit || 100)),
      select: {
        id: true,
        userId: true,
        email: true,
        success: true,
        reason: true,
        ip: true,
        userAgent: true,
        createdAt: true,
      },
    });
  }

  private async issueSession(user: User, policy: PasswordPolicy) {
    const tenantKey = user.companyId
      ? await this.resolveTenantKey(user.companyId)
      : null;
    const resolved = await this.resolvePermissions(user);
    const driverId = await this.resolveDriverId(user);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      tenantKey,
      permissions: resolved.permissions,
      driverId,
      customRoleId: user.customRoleId,
      customRoleName: resolved.customRoleName,
      tv: user.tokenVersion,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: `${policy.sessionDays}d`,
    });
    return {
      accessToken,
      user: await this.toPublicUser(
        user,
        tenantKey,
        resolved.permissions,
        driverId,
        resolved.customRoleName,
      ),
      session: {
        sessionDays: policy.sessionDays,
        idleTimeoutMinutes: policy.idleTimeoutMinutes,
        passwordPolicy: publicPasswordPolicy(policy),
        mfaRequired: false,
        mfaFlag: policy.requireMfa,
      },
    };
  }

  private async resolvePasswordPolicy(
    companyId: string | null,
  ): Promise<PasswordPolicy> {
    if (!companyId) return { ...PLATFORM_PASSWORD_POLICY };
    const row = await this.fetchSecurityPolicy(companyId);
    return policyFromRow(row);
  }

  private async fetchSecurityPolicy(
    companyId: string,
  ): Promise<Record<string, unknown> | null> {
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
      return (await res.json()) as Record<string, unknown>;
    } catch (e) {
      this.logger.warn(`security policy resolve failed: ${String(e)}`);
      return null;
    }
  }

  private async hashNewPassword(password: string, companyId: string | null) {
    const policy = await this.resolvePasswordPolicy(companyId);
    const err = assertPasswordMeetsPolicy(password, policy);
    if (err) throw new BadRequestException(err);
    return bcrypt.hash(password, 10);
  }

  private async recordLogin(input: {
    user?: User;
    email?: string;
    success: boolean;
    reason: string;
    meta: RequestMeta;
  }) {
    try {
      await this.prisma.loginEvent.create({
        data: {
          userId: input.user?.id || null,
          email: (input.user?.email || input.email || '').toLowerCase(),
          companyId: input.user?.companyId || null,
          success: input.success,
          reason: input.reason,
          ip: (input.meta.ip || '').slice(0, 80),
          userAgent: (input.meta.userAgent || '').slice(0, 500),
        },
      });
    } catch (e) {
      this.logger.warn(`login event failed: ${String(e)}`);
    }
    if (input.user?.companyId && (input.success || input.reason === 'lockout')) {
      await this.auditAuth(input.user.companyId, {
        actorId: input.user.id,
        actorName: input.user.email,
        action: input.success ? 'login.success' : 'login.lockout',
        entityId: input.user.id,
        meta: { reason: input.reason },
      });
    }
  }

  private async auditAuth(
    companyId: string | null,
    body: {
      actorId?: string;
      actorName?: string;
      action: string;
      entityId: string;
      meta?: Record<string, unknown>;
    },
  ) {
    if (!companyId) return;
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    try {
      await fetch(`${base.replace(/\/$/, '')}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          actorId: body.actorId || null,
          actorName: body.actorName || '',
          action: body.action,
          entityType: 'auth',
          entityId: body.entityId,
          meta: body.meta,
        }),
      });
    } catch (e) {
      this.logger.warn(`auth audit failed: ${String(e)}`);
    }
  }

  private async resolveTenantKey(companyId: string): Promise<string | null> {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/connection`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { tenantKey?: string };
      return data.tenantKey || null;
    } catch (e) {
      this.logger.warn(`tenantKey resolve failed: ${String(e)}`);
      return null;
    }
  }

  private async fetchCustomRole(
    companyId: string,
    roleId: string,
  ): Promise<{
    id: string;
    name: string;
    baseRole: string;
    permissions: string[];
  } | null> {
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    try {
      const res = await fetch(
        `${base.replace(/\/$/, '')}/internal/tenants/${encodeURIComponent(companyId)}/custom-roles/${encodeURIComponent(roleId)}`,
        { headers: { 'x-internal-api-key': key } },
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        id: string;
        name: string;
        baseRole: string;
        permissions: string[];
      };
    } catch (e) {
      this.logger.warn(`custom role resolve failed: ${String(e)}`);
      return null;
    }
  }

  private async resolvePermissions(user: User): Promise<{
    permissions: string[];
    customRoleName: string | null;
  }> {
    if (user.customRoleId && user.companyId) {
      const custom = await this.fetchCustomRole(
        user.companyId,
        user.customRoleId,
      );
      if (custom) {
        return {
          permissions: custom.permissions || [],
          customRoleName: custom.name,
        };
      }
    }
    return {
      permissions: await this.rbac.permissionsForRole(user.role),
      customRoleName: null,
    };
  }

  private async auditRoleChanged(input: {
    companyId: string | null;
    actorId?: string;
    actorName?: string;
    userId: string;
    before: { role: string; customRoleId: string | null };
    after: { role: string; customRoleId: string | null };
  }) {
    if (!input.companyId) return;
    const base =
      this.config.get<string>('COMPANY_SERVICE_URL') ||
      'http://localhost:3002';
    try {
      await fetch(`${base.replace(/\/$/, '')}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: input.companyId,
          actorId: input.actorId || null,
          actorName: input.actorName || '',
          action: 'role.changed',
          entityType: 'user',
          entityId: input.userId,
          before: input.before,
          after: input.after,
        }),
      });
    } catch (e) {
      this.logger.warn(`role.changed audit failed: ${String(e)}`);
    }
  }

  private async resolveDriverId(user: User): Promise<string | null> {
    if (user.role !== 'driver' || !user.companyId) return null;
    const base =
      this.config.get<string>('DRIVER_SERVICE_URL') ||
      'http://localhost:3003';
    try {
      const q = new URLSearchParams({
        companyId: user.companyId,
        userId: user.id,
      });
      const res = await fetch(
        `${base.replace(/\/$/, '')}/drivers?${q.toString()}`,
        {
          headers: {
            'x-user-id': user.id,
            'x-user-role': 'driver',
            'x-company-id': user.companyId,
            'x-tenant-routing': 'tenant',
          },
        },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{ id?: string; userId?: string }>;
      const match = rows.find((d) => d.userId === user.id) || rows[0];
      return match?.id || null;
    } catch (e) {
      this.logger.warn(`driverId resolve failed: ${String(e)}`);
      return null;
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const tenantKey = user.companyId
      ? await this.resolveTenantKey(user.companyId)
      : null;
    const driverId = await this.resolveDriverId(user);
    const policy = await this.resolvePasswordPolicy(user.companyId);
    const publicUser = await this.toPublicUser(
      user,
      tenantKey,
      undefined,
      driverId,
    );
    return {
      ...publicUser,
      session: {
        sessionDays: policy.sessionDays,
        idleTimeoutMinutes: policy.idleTimeoutMinutes,
        passwordPolicy: publicPasswordPolicy(policy),
        mfaRequired: false,
        mfaFlag: policy.requireMfa,
      },
    };
  }

  async createUser(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await this.hashNewPassword(
      dto.password,
      dto.companyId ?? null,
    );
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name,
        role: this.asRole(dto.role),
        companyId: dto.companyId ?? null,
      },
    });

    return this.toPublicUser(user);
  }

  /**
   * Invite / service retries: create user, or return existing if same email.
   * Only for internal service calls — not for public registration.
   */
  async createUserOrGet(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      const data: Prisma.UserUpdateInput = {};
      if (dto.name && dto.name !== existing.name) data.name = dto.name;
      if (dto.companyId !== undefined && dto.companyId !== existing.companyId) {
        data.companyId = dto.companyId;
      }
      if (dto.role && this.asRole(dto.role) !== existing.role) {
        data.role = this.asRole(dto.role);
      }
      if (dto.password?.length) {
        data.passwordHash = await this.hashNewPassword(
          dto.password,
          dto.companyId !== undefined ? dto.companyId : existing.companyId,
        );
        data.tokenVersion = { increment: 1 };
      }
      if (Object.keys(data).length > 0) {
        const updated = await this.prisma.user.update({
          where: { id: existing.id },
          data,
        });
        return this.toPublicUser(updated);
      }
      return this.toPublicUser(existing);
    }
    return this.createUser(dto);
  }

  async listUsers(companyId?: string) {
    const users = await this.prisma.user.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    const cache = new Map<
      string,
      { permissions: string[]; customRoleName: string | null }
    >();
    const result: Awaited<ReturnType<AuthService['toPublicUser']>>[] = [];
    for (const u of users) {
      const key = u.customRoleId
        ? `custom:${u.customRoleId}`
        : `sys:${u.role}`;
      if (!cache.has(key)) {
        cache.set(key, await this.resolvePermissions(u));
      }
      const resolved = cache.get(key)!;
      result.push(
        await this.toPublicUser(
          u,
          undefined,
          resolved.permissions,
          undefined,
          resolved.customRoleName,
        ),
      );
    }
    return result;
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actor?: { id?: string; email?: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.companyId !== undefined) data.companyId = dto.companyId;
    if (dto.password?.length) {
      data.passwordHash = await this.hashNewPassword(
        dto.password,
        dto.companyId !== undefined ? dto.companyId : existing.companyId,
      );
      data.tokenVersion = { increment: 1 };
      data.failedLoginCount = 0;
      data.lockedUntil = null;
    }

    const privileged =
      existing.role === 'superadmin' || existing.role === 'company_owner';

    if (dto.customRoleId) {
      if (privileged) {
        throw new ForbiddenException(
          'Cannot assign a custom role to Company Owner or Super Admin',
        );
      }
      const companyId = dto.companyId !== undefined
        ? dto.companyId
        : existing.companyId;
      if (!companyId) {
        throw new BadRequestException(
          'User must belong to a company to assign a custom role',
        );
      }
      const custom = await this.fetchCustomRole(companyId, dto.customRoleId);
      if (!custom) {
        throw new BadRequestException('Custom role not found');
      }
      data.customRoleId = custom.id;
      data.role = this.asRole(custom.baseRole);
    } else if (dto.customRoleId === null) {
      data.customRoleId = null;
      if (dto.role !== undefined) data.role = this.asRole(dto.role);
    } else if (dto.role !== undefined) {
      data.role = this.asRole(dto.role);
      data.customRoleId = null;
    }

    const user = await this.prisma.user.update({ where: { id }, data });

    const before = {
      role: existing.role,
      customRoleId: existing.customRoleId,
    };
    const after = {
      role: user.role,
      customRoleId: user.customRoleId,
    };
    if (
      before.role !== after.role ||
      before.customRoleId !== after.customRoleId
    ) {
      await this.auditRoleChanged({
        companyId: user.companyId || existing.companyId,
        actorId: actor?.id,
        actorName: actor?.email,
        userId: user.id,
        before,
        after,
      });
    }

    return this.toPublicUser(user);
  }

  async removeUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  private asRole(role: string): Role {
    return normalizeRoleCode(role) as Role;
  }

  private async toPublicUser(
    user: User,
    tenantKey?: string | null,
    permissions?: string[],
    driverId?: string | null,
    customRoleName?: string | null,
  ) {
    let perms = permissions;
    let roleName = customRoleName;
    if (perms === undefined || (user.customRoleId && roleName === undefined)) {
      const resolved = await this.resolvePermissions(user);
      perms = perms ?? resolved.permissions;
      roleName = roleName ?? resolved.customRoleName;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      customRoleId: user.customRoleId,
      customRoleName: roleName ?? null,
      permissions: perms ?? [],
      ...(tenantKey !== undefined ? { tenantKey } : {}),
      ...(driverId !== undefined ? { driverId } : {}),
    };
  }
}
