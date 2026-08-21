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
import { createHash, randomBytes } from 'crypto';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import { RbacService } from '../rbac/rbac.service';
import { normalizeRoleCode } from '../rbac/rbac.catalog';
import {
  PLATFORM_PASSWORD_POLICY,
  assertPasswordMeetsPolicy,
  policyFromRow,
  publicPasswordPolicy,
  type PasswordIdentity,
  type PasswordPolicy,
} from './password.policy';
import {
  accessTokenMinutesFromEnv,
  deviceLabelFromUa,
  hashRefreshToken,
  isSessionIdle,
} from './session.util';
import { decryptSecret, encryptSecret } from './mfa.crypto';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  verifyTotp,
} from './mfa.totp';
import {
  isSecurityNotifyType,
  securityEventSeverity,
  securityNotifyBody,
  securityNotifyPayload,
  type SecurityNotifyInput,
} from './security-notify';
import type { JwtActor } from '../rbac/actor';
import {
  ADMIN_SETTABLE_STATUSES,
  canAuthenticateStatus,
  isUserStatus,
  statusDenyReason,
} from './user-status';

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
    if (!canAuthenticateStatus(user.status)) {
      await this.recordLogin({
        user,
        success: false,
        reason: `status_${user.status}`,
        meta,
      });
      await this.auditAuth(user.companyId, {
        actorId: user.id,
        actorName: user.email,
        action: 'login.denied',
        entityId: user.id,
        meta: { status: user.status, reason: statusDenyReason(user.status) },
      });
      throw new UnauthorizedException(statusDenyReason(user.status));
    }

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

    // MFA challenge or forced enrollment before issuing a session
    if (unlocked.mfaEnabled && unlocked.mfaSecretEnc) {
      const mfaToken = await this.signMfaToken(unlocked, 'mfa_challenge');
      await this.recordLogin({
        user: unlocked,
        success: false,
        reason: 'mfa_required',
        meta,
      });
      return {
        mfaRequired: true,
        mfaToken,
        message: 'Enter the code from your authenticator app.',
      };
    }
    if (policy.requireMfa && !unlocked.mfaEnabled) {
      const mfaToken = await this.signMfaToken(unlocked, 'mfa_enroll');
      await this.recordLogin({
        user: unlocked,
        success: false,
        reason: 'mfa_enroll_required',
        meta,
      });
      return {
        mfaEnrollmentRequired: true,
        mfaToken,
        message:
          'Your company requires MFA. Set up an authenticator to finish signing in.',
      };
    }

    await this.recordLogin({ user: unlocked, success: true, reason: 'ok', meta });
    return this.issueSession(unlocked, policy, meta);
  }

  async getSessionSnapshot(userId: string, sessionId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tokenVersion: true,
        lockedUntil: true,
        status: true,
      },
    });
    if (!user) {
      return {
        tokenVersion: -1,
        lockedUntil: null,
        status: null as string | null,
        authAllowed: false,
        sessionActive: false,
      };
    }
    let sessionActive = true;
    if (sessionId) {
      const sess = await this.prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          userId: true,
          revokedAt: true,
          expiresAt: true,
        },
      });
      sessionActive = Boolean(
        sess &&
          sess.userId === userId &&
          !sess.revokedAt &&
          sess.expiresAt.getTime() > Date.now(),
      );
    }
    return {
      tokenVersion: user.tokenVersion,
      lockedUntil: user.lockedUntil?.toISOString() || null,
      status: user.status,
      authAllowed: canAuthenticateStatus(user.status) && sessionActive,
      sessionActive,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta = {},
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    const passwordHash = await this.hashPasswordForUser(dto.newPassword, user);
    await this.applyPasswordChange(user, passwordHash, {
      bumpTokenVersion: true,
      clearLockout: true,
    });
    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const policy = await this.resolvePasswordPolicy(updated.companyId);
    return this.issueSession(updated, policy, meta);
  }

  async logoutAllSessions(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.revokeAllSessionsForUser(userId, 'logout_all');
    await this.auditAuth(user.companyId, {
      actorId: user.id,
      actorName: user.email,
      action: 'session.revoked_all',
      entityId: user.id,
    });
    return { ok: true };
  }

  async logoutCurrent(userId: string, dto: { refreshToken?: string }, sid?: string) {
    if (dto.refreshToken) {
      const hash = hashRefreshToken(dto.refreshToken.trim());
      const row = await this.prisma.session.findUnique({
        where: { refreshTokenHash: hash },
      });
      if (row && row.userId === userId && !row.revokedAt) {
        await this.prisma.session.update({
          where: { id: row.id },
          data: { revokedAt: new Date(), revokeReason: 'logout' },
        });
      }
    } else if (sid) {
      await this.prisma.session.updateMany({
        where: { id: sid, userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'logout' },
      });
    }
    return { ok: true };
  }

  async refreshSession(dto: { refreshToken: string }, meta: RequestMeta = {}) {
    const hash = hashRefreshToken(dto.refreshToken.trim());
    const row = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: true },
    });
    if (!row || row.revokedAt) {
      throw new UnauthorizedException('Refresh token invalid');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), revokeReason: 'expired' },
      });
      throw new UnauthorizedException('Refresh token expired');
    }
    const user = row.user;
    if (!canAuthenticateStatus(user.status)) {
      throw new UnauthorizedException(statusDenyReason(user.status));
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }
    const policy = await this.resolvePasswordPolicy(user.companyId);
    if (isSessionIdle(row.lastSeenAt, policy.idleTimeoutMinutes)) {
      await this.prisma.session.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), revokeReason: 'idle' },
      });
      throw new UnauthorizedException('Session idle timeout');
    }

    const rawRefresh = randomBytes(32).toString('hex');
    const nextHash = hashRefreshToken(rawRefresh);
    await this.prisma.session.update({
      where: { id: row.id },
      data: {
        refreshTokenHash: nextHash,
        lastSeenAt: new Date(),
        ip: (meta.ip || row.ip).slice(0, 80),
        userAgent: (meta.userAgent || row.userAgent).slice(0, 500),
      },
    });

    return this.issueAccessOnly(user, policy, row.id, rawRefresh);
  }

  async listSessions(userId: string, currentSid?: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
    });
    return rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel || deviceLabelFromUa(s.userAgent),
      userAgent: s.userAgent,
      ip: s.ip,
      trusted: s.trusted,
      current: Boolean(currentSid && currentSid === s.id),
      active: !s.revokedAt && s.expiresAt.getTime() > Date.now(),
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() || null,
      revokeReason: s.revokeReason || '',
    }));
  }

  async patchSession(
    userId: string,
    sessionId: string,
    dto: { deviceLabel?: string; trusted?: boolean },
  ) {
    const row = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    const data: Prisma.SessionUpdateInput = {};
    if (dto.deviceLabel !== undefined) {
      data.deviceLabel = dto.deviceLabel.trim().slice(0, 80);
    }
    if (dto.trusted !== undefined) data.trusted = Boolean(dto.trusted);
    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data,
    });
    return {
      id: updated.id,
      deviceLabel: updated.deviceLabel,
      trusted: updated.trusted,
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const row = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    if (!row.revokedAt) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date(), revokeReason: 'remote' },
      });
    }
    return { ok: true };
  }

  async sessionHistory(userId: string, limit = 40) {
    const take = Math.min(100, Math.max(1, limit));
    const [sessions, logins] = await Promise.all([
      this.listSessions(userId),
      this.prisma.loginEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          success: true,
          reason: true,
          ip: true,
          userAgent: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      sessions,
      loginEvents: logins.map((e) => ({
        id: e.id,
        success: e.success,
        reason: e.reason,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt.toISOString(),
      })),
      idleNote:
        'Server idle uses refresh inactivity (lastSeenAt). Client idleTimeoutMinutes remains an optional UX timer.',
    };
  }

  /**
   * Always returns ok (no email enumeration). Queues reset link when user exists and is active.
   */
  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta = {}) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && canAuthenticateStatus(user.status)) {
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      const raw = randomBytes(32).toString('hex');
      const tokenHash = this.hashResetToken(raw);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      void this.queuePasswordResetEmail(user, raw);
      await this.auditAuth(user.companyId, {
        actorId: user.id,
        actorName: user.email,
        action: 'password.reset_requested',
        entityId: user.id,
        meta: { ip: meta.ip },
      });
      const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
      const expose =
        this.config.get<string>('AUTH_EXPOSE_RESET_URL') === '1' ||
        this.config.get<string>('NODE_ENV') === 'test' ||
        !notifyUrl;
      if (expose) {
        const origin =
          this.config.get<string>('APP_PUBLIC_ORIGIN') ||
          this.config.get<string>('INVITE_PUBLIC_ORIGIN') ||
          'http://localhost:5173';
        return {
          ok: true,
          message: notifyUrl
            ? 'Reset link queued (resetUrl exposed for local/test).'
            : 'Reset link ready (notification service not configured — use resetUrl locally).',
          resetUrl: `${origin.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(raw)}`,
        };
      }
    } else {
      await this.recordLogin({
        email,
        user: user || undefined,
        success: false,
        reason: user ? `status_${user.status}` : 'unknown_user',
        meta,
      });
    }
    return {
      ok: true,
      message:
        'If an account exists for that email, a reset link has been queued.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta = {}) {
    const tokenHash = this.hashResetToken(dto.token.trim());
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Reset link is invalid or expired');
    }
    const user = row.user;
    if (!canAuthenticateStatus(user.status)) {
      throw new UnauthorizedException(statusDenyReason(user.status));
    }
    const passwordHash = await this.hashPasswordForUser(dto.newPassword, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await this.pushPasswordHistory(
        tx,
        user.id,
        user.passwordHash,
        user.companyId,
      );
    });
    await this.revokeAllSessionsForUser(user.id, 'password_reset');
    await this.auditAuth(user.companyId, {
      actorId: user.id,
      actorName: user.email,
      action: 'password.reset',
      entityId: user.id,
      meta: { ip: meta.ip },
    });
    void this.emitSecurityNotify({
      type: 'security.password_changed',
      to: user.email,
      companyId: user.companyId,
      userId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      detail: 'Via password reset link.',
    });
    await this.recordLogin({
      user,
      success: true,
      reason: 'password_reset',
      meta,
    });
    return {
      ok: true,
      message: 'Password updated. Sign in with your new password.',
    };
  }

  private hashResetToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async queuePasswordResetEmail(user: User, rawToken: string) {
    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    const origin =
      this.config.get<string>('APP_PUBLIC_ORIGIN') ||
      this.config.get<string>('INVITE_PUBLIC_ORIGIN') ||
      'http://localhost:5173';
    if (!notifyUrl) return;
    const link = `${origin.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await fetch(`${notifyUrl.replace(/\/$/, '')}/notifications/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: user.companyId || null,
          channel: 'email',
          to: user.email,
          body: `Reset your FleetQuix password (link expires in 1 hour): ${link}`,
          status: 'queued',
          meta: { type: 'password_reset', userId: user.id },
        }),
      });
    } catch (e) {
      this.logger.warn(`password reset email log failed: ${String(e)}`);
    }
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

  private async issueSession(
    user: User,
    policy: PasswordPolicy,
    meta: RequestMeta = {},
  ) {
    const rawRefresh = randomBytes(32).toString('hex');
    const refreshTokenHash = hashRefreshToken(rawRefresh);
    const ua = (meta.userAgent || '').slice(0, 500);
    const expiresAt = new Date(
      Date.now() + policy.sessionDays * 24 * 60 * 60 * 1000,
    );
    const sess = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        userAgent: ua,
        ip: (meta.ip || '').slice(0, 80),
        deviceLabel: deviceLabelFromUa(ua),
        expiresAt,
        lastSeenAt: new Date(),
      },
    });
    return this.issueAccessOnly(user, policy, sess.id, rawRefresh);
  }

  private async issueAccessOnly(
    user: User,
    policy: PasswordPolicy,
    sessionId: string,
    refreshToken: string,
  ) {
    const tenantKey = user.companyId
      ? await this.resolveTenantKey(user.companyId)
      : null;
    const resolved = await this.resolvePermissions(user);
    const driverId = await this.resolveDriverId(user);
    const accessMinutes = accessTokenMinutesFromEnv(
      this.config.get<string>('ACCESS_TOKEN_MINUTES'),
    );
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
      sid: sessionId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: `${accessMinutes}m`,
    });
    return {
      accessToken,
      refreshToken,
      user: await this.toPublicUser(
        user,
        tenantKey,
        resolved.permissions,
        driverId,
        resolved.customRoleName,
      ),
      session: {
        id: sessionId,
        sessionDays: policy.sessionDays,
        accessTokenMinutes: accessMinutes,
        idleTimeoutMinutes: policy.idleTimeoutMinutes,
        passwordPolicy: publicPasswordPolicy(policy),
        mfaRequired: Boolean(user.mfaEnabled),
        mfaEnabled: Boolean(user.mfaEnabled),
        requireMfa: policy.requireMfa,
        idleNote:
          'Access JWT is short-lived; refresh renews while active. Idle timeout applies on refresh (server) and optionally in the browser.',
      },
    };
  }

  private async revokeAllSessionsForUser(userId: string, reason: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
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

  private async hashNewPassword(
    password: string,
    companyId: string | null,
    identity?: PasswordIdentity | null,
  ) {
    const policy = await this.resolvePasswordPolicy(companyId);
    const err = assertPasswordMeetsPolicy(password, policy, identity);
    if (err) throw new BadRequestException(err);
    return bcrypt.hash(password, 10);
  }

  /** Validate + hash for an existing user (policy + history + identity bans). */
  private async hashPasswordForUser(password: string, user: User) {
    const policy = await this.resolvePasswordPolicy(user.companyId);
    const err = assertPasswordMeetsPolicy(password, policy, {
      name: user.name,
      email: user.email,
    });
    if (err) throw new BadRequestException(err);
    if (policy.historyCount > 0) {
      const prior = await this.prisma.passwordHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: Math.max(0, policy.historyCount - 1),
        select: { passwordHash: true },
      });
      const hashes = [user.passwordHash, ...prior.map((p) => p.passwordHash)];
      for (const h of hashes.slice(0, policy.historyCount)) {
        if (await bcrypt.compare(password, h)) {
          throw new BadRequestException(
            `Password must not match any of your last ${policy.historyCount} passwords`,
          );
        }
      }
    }
    return bcrypt.hash(password, 10);
  }

  private async pushPasswordHistory(
    tx: Prisma.TransactionClient,
    userId: string,
    previousHash: string,
    companyId: string | null,
  ) {
    const policy = await this.resolvePasswordPolicy(companyId);
    if (policy.historyCount <= 0) return;
    await tx.passwordHistory.create({
      data: { userId, passwordHash: previousHash },
    });
    const keep = await tx.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: policy.historyCount,
      select: { id: true },
    });
    if (keep.length) {
      await tx.passwordHistory.deleteMany({
        where: { id: { in: keep.map((r) => r.id) } },
      });
    }
  }

  private async applyPasswordChange(
    user: User,
    passwordHash: string,
    opts: { bumpTokenVersion: boolean; clearLockout: boolean },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          ...(opts.bumpTokenVersion ? { tokenVersion: { increment: 1 } } : {}),
          ...(opts.clearLockout
            ? { failedLoginCount: 0, lockedUntil: null }
            : {}),
        },
      });
      await this.pushPasswordHistory(
        tx,
        user.id,
        user.passwordHash,
        user.companyId,
      );
    });
    if (opts.bumpTokenVersion) {
      await this.revokeAllSessionsForUser(user.id, 'password_changed');
      void this.emitSecurityNotify({
        type: 'security.password_changed',
        to: user.email,
        companyId: user.companyId,
        userId: user.id,
      });
    }
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
    if (input.user && input.success) {
      void this.emitSecurityNotify({
        type: 'security.login',
        to: input.user.email,
        companyId: input.user.companyId,
        userId: input.user.id,
        ip: input.meta.ip,
        userAgent: input.meta.userAgent,
        detail: input.reason !== 'ok' ? `Via ${input.reason}.` : undefined,
      });
    }
    if (input.user && input.reason === 'lockout') {
      void this.emitSecurityNotify({
        type: 'security.lockout',
        to: input.user.email,
        companyId: input.user.companyId,
        userId: input.user.id,
        ip: input.meta.ip,
        userAgent: input.meta.userAgent,
      });
    }
  }

  /**
   * Persist SecurityEvent + queue email notification (fire-and-forget safe).
   */
  async ingestSecurityNotify(body: {
    type: string;
    to: string;
    companyId?: string;
    userId?: string;
    detail?: string;
    ip?: string;
    userAgent?: string;
  }) {
    if (!isSecurityNotifyType(body.type)) {
      throw new BadRequestException(`Unsupported security event: ${body.type}`);
    }
    await this.emitSecurityNotify({
      type: body.type,
      to: body.to,
      companyId: body.companyId,
      userId: body.userId,
      detail: body.detail,
      ip: body.ip,
      userAgent: body.userAgent,
    });
    return { ok: true };
  }

  private async emitSecurityNotify(input: SecurityNotifyInput) {
    const payload = securityNotifyPayload(input);
    if (!payload.to) return;
    try {
      await this.prisma.securityEvent.create({
        data: {
          userId: input.userId || null,
          companyId: input.companyId || null,
          type: input.type,
          severity: securityEventSeverity(input.type),
          message: securityNotifyBody(input).slice(0, 2000),
          ip: (input.ip || '').slice(0, 80),
          userAgent: (input.userAgent || '').slice(0, 500),
          meta: {
            subject: payload.meta.subject,
            detail: input.detail || '',
          },
        },
      });
    } catch (e) {
      this.logger.warn(`security event persist failed: ${String(e)}`);
    }
    const notifyUrl = this.config.get<string>('NOTIFICATION_SERVICE_URL');
    if (!notifyUrl) {
      this.logger.log(
        `security notify (no NOTIFICATION_SERVICE_URL): ${input.type} → ${payload.to}`,
      );
      return;
    }
    try {
      await fetch(`${notifyUrl.replace(/\/$/, '')}/notifications/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      this.logger.warn(`security notify queue failed: ${String(e)}`);
    }
  }

  async listSecurityEvents(
    actor: JwtActor | undefined,
    opts: { limit?: number; scope?: 'self' | 'company'; companyId?: string },
  ) {
    if (!actor?.sub) throw new UnauthorizedException('Not authenticated');
    const limit = Math.min(100, Math.max(1, opts.limit || 40));
    const privileged =
      actor.role === 'superadmin' ||
      actor.role === 'company_owner' ||
      Boolean(actor.permissions?.includes('admin.security')) ||
      Boolean(actor.permissions?.includes('admin.audit')) ||
      Boolean(actor.permissions?.includes('users.view'));

    if (opts.scope === 'company') {
      if (!privileged) {
        throw new ForbiddenException('Cannot view company security events');
      }
      const companyId =
        opts.companyId ||
        (actor.role === 'superadmin' ? opts.companyId : actor.companyId) ||
        actor.companyId;
      if (!companyId) {
        throw new BadRequestException('companyId required');
      }
      if (
        actor.role !== 'superadmin' &&
        actor.companyId &&
        actor.companyId !== companyId
      ) {
        throw new ForbiddenException('Cannot access another company');
      }
      return this.prisma.securityEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    }

    return this.prisma.securityEvent.findMany({
      where: { userId: actor.sub },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
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
    email?: string;
    before: { role: string; customRoleId: string | null };
    after: { role: string; customRoleId: string | null };
  }) {
    if (input.companyId) {
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
    if (input.email) {
      void this.emitSecurityNotify({
        type: 'security.role_changed',
        to: input.email,
        companyId: input.companyId,
        userId: input.userId,
        detail: `From ${input.before.role} to ${input.after.role}.`,
      });
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
        accessTokenMinutes: accessTokenMinutesFromEnv(
          this.config.get<string>('ACCESS_TOKEN_MINUTES'),
        ),
        idleTimeoutMinutes: policy.idleTimeoutMinutes,
        passwordPolicy: publicPasswordPolicy(policy),
        mfaRequired: Boolean(user.mfaEnabled),
        mfaEnabled: Boolean(user.mfaEnabled),
        requireMfa: policy.requireMfa,
        idleNote:
          'Access JWT is short-lived; refresh renews while active. Idle timeout applies on refresh (server) and optionally in the browser.',
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
      { name: dto.name, email },
    );
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name,
        role: this.asRole(dto.role),
        companyId: dto.companyId ?? null,
        status: 'active',
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
      if (dto.password?.length) {
        const companyId =
          dto.companyId !== undefined ? dto.companyId : existing.companyId;
        const passwordHash = await this.hashPasswordForUser(dto.password, {
          ...existing,
          name: dto.name || existing.name,
          email,
          companyId,
        });
        await this.applyPasswordChange(existing, passwordHash, {
          bumpTokenVersion: true,
          clearLockout: true,
        });
        const refreshed = await this.prisma.user.findUniqueOrThrow({
          where: { id: existing.id },
        });
        // Continue with other field updates on refreshed row
        Object.assign(existing, refreshed);
        // role/name/company updates below still apply via data
      }
      if (dto.name && dto.name !== existing.name) data.name = dto.name;
      if (dto.companyId !== undefined && dto.companyId !== existing.companyId) {
        data.companyId = dto.companyId;
      }
      if (dto.role && this.asRole(dto.role) !== existing.role) {
        data.role = this.asRole(dto.role);
        data.tokenVersion = { increment: 1 };
      }
      // password already applied above
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

  async listUsers(companyId?: string, opts?: { includeArchived?: boolean }) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(opts?.includeArchived
          ? {}
          : { status: { not: 'archived' }, deletedAt: null }),
      },
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
    actor?: { id?: string; email?: string; role?: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const before = {
      role: existing.role,
      customRoleId: existing.customRoleId,
      status: existing.status,
    };
    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.companyId !== undefined) data.companyId = dto.companyId;
    let passwordApplied = false;
    if (dto.password?.length) {
      const companyId =
        dto.companyId !== undefined ? dto.companyId : existing.companyId;
      const passwordHash = await this.hashPasswordForUser(dto.password, {
        ...existing,
        name: dto.name ?? existing.name,
        companyId,
      });
      await this.applyPasswordChange(existing, passwordHash, {
        bumpTokenVersion: true,
        clearLockout: true,
      });
      passwordApplied = true;
      // refresh existing snapshot for subsequent status/role logic
      Object.assign(
        existing,
        await this.prisma.user.findUniqueOrThrow({ where: { id: existing.id } }),
      );
    }

    const privileged =
      existing.role === 'superadmin' || existing.role === 'company_owner';

    if (dto.customRoleId) {
      if (privileged) {
        throw new ForbiddenException(
          'Cannot assign a custom role to Company Owner or Super Admin',
        );
      }
      const companyId =
        dto.companyId !== undefined ? dto.companyId : existing.companyId;
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

    if (dto.status !== undefined) {
      this.applyStatusChange(existing, dto.status, data, actor);
    }

    const nextRole =
      typeof data.role === 'string' ? data.role : existing.role;
    const nextCustom =
      data.customRoleId === null
        ? null
        : typeof data.customRoleId === 'string'
          ? data.customRoleId
          : existing.customRoleId;
    const roleChanging =
      nextRole !== existing.role ||
      (nextCustom || null) !== (existing.customRoleId || null);
    if (roleChanging && data.tokenVersion === undefined && !passwordApplied) {
      data.tokenVersion = { increment: 1 };
    }

    if (Object.keys(data).length === 0) {
      return this.toPublicUser(existing);
    }

    const user = await this.prisma.user.update({ where: { id }, data });

    if (
      before.role !== user.role ||
      before.customRoleId !== user.customRoleId ||
      before.status !== user.status
    ) {
      // tokenVersion may already be incremented; ensure device sessions die too
      await this.revokeAllSessionsForUser(user.id, 'account_changed');
    }

    const after = {
      role: user.role,
      customRoleId: user.customRoleId,
      status: user.status,
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
        email: user.email,
        before: { role: before.role, customRoleId: before.customRoleId },
        after: { role: after.role, customRoleId: after.customRoleId },
      });
    }
    if (before.status !== after.status) {
      await this.auditAuth(user.companyId || existing.companyId, {
        actorId: actor?.id,
        actorName: actor?.email || '',
        action: 'user.status_changed',
        entityId: user.id,
        meta: { before: before.status, after: after.status },
      });
    }

    return this.toPublicUser(user);
  }

  /**
   * Soft-archive only (Chapter 4: never permanently delete users with history).
   */
  async removeUser(
    id: string,
    actor?: { id?: string; email?: string; role?: string },
  ) {
    return this.updateUser(id, { status: 'archived' }, actor);
  }

  /**
   * Admin unlock: clears temporary lockout and/or status=locked → active.
   */
  async unlockUser(
    id: string,
    actor?: { id?: string; email?: string; role?: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (actor?.id && actor.id === existing.id) {
      throw new ForbiddenException('Cannot unlock yourself');
    }
    if (
      existing.role === 'superadmin' &&
      actor?.role !== 'superadmin'
    ) {
      throw new ForbiddenException('Only Super Admin can unlock Super Admin');
    }

    const data: Prisma.UserUpdateInput = {
      failedLoginCount: 0,
      lockedUntil: null,
    };
    if (existing.status === 'locked') {
      data.status = 'active';
      data.tokenVersion = { increment: 1 };
      data.suspendedAt = null;
      data.archivedAt = null;
      data.deletedAt = null;
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    if (existing.status === 'locked') {
      await this.revokeAllSessionsForUser(user.id, 'unlocked');
    }
    await this.auditAuth(user.companyId || existing.companyId, {
      actorId: actor?.id,
      actorName: actor?.email || '',
      action: 'user.unlocked',
      entityId: user.id,
      meta: {
        beforeStatus: existing.status,
        afterStatus: user.status,
        clearedLockout: true,
      },
    });
    return this.toPublicUser(user);
  }

  private applyStatusChange(
    existing: User,
    nextRaw: string,
    data: Prisma.UserUpdateInput,
    actor?: { id?: string; email?: string; role?: string },
  ) {
    if (!isUserStatus(nextRaw) || !ADMIN_SETTABLE_STATUSES.has(nextRaw)) {
      throw new BadRequestException(`Invalid status: ${nextRaw}`);
    }
    if (actor?.id && actor.id === existing.id) {
      if (nextRaw === 'suspended' || nextRaw === 'archived' || nextRaw === 'locked') {
        throw new ForbiddenException('Cannot suspend, lock, or archive yourself');
      }
    }
    if (
      existing.role === 'superadmin' &&
      actor?.role !== 'superadmin' &&
      nextRaw !== 'active'
    ) {
      throw new ForbiddenException('Only Super Admin can change Super Admin status');
    }

    const next = nextRaw as User['status'];
    if (next === existing.status) return;

    data.status = next;
    data.tokenVersion = { increment: 1 };

    if (next === 'suspended') {
      data.suspendedAt = new Date();
      data.archivedAt = null;
      data.deletedAt = null;
    } else if (next === 'archived') {
      data.archivedAt = new Date();
      data.deletedAt = new Date();
      data.suspendedAt = existing.suspendedAt || new Date();
    } else if (next === 'active') {
      data.suspendedAt = null;
      data.archivedAt = null;
      data.deletedAt = null;
      data.lockedUntil = null;
      data.failedLoginCount = 0;
    } else if (next === 'locked') {
      data.lockedUntil = null;
    } else if (next === 'inactive') {
      data.suspendedAt = null;
    }
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
      status: user.status,
      lockedUntil: user.lockedUntil?.toISOString() || null,
      suspendedAt: user.suspendedAt?.toISOString() || null,
      archivedAt: user.archivedAt?.toISOString() || null,
      customRoleId: user.customRoleId,
      customRoleName: roleName ?? null,
      permissions: perms ?? [],
      mfaEnabled: Boolean(user.mfaEnabled),
      ...(tenantKey !== undefined ? { tenantKey } : {}),
      ...(driverId !== undefined ? { driverId } : {}),
    };
  }

  private mfaMasterKey() {
    return (
      this.config.get<string>('MFA_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_SECRET') ||
      'change-me-in-production'
    );
  }

  private async signMfaToken(
    user: User,
    purpose: 'mfa_challenge' | 'mfa_enroll',
  ) {
    return this.jwt.signAsync(
      { sub: user.id, purpose, tv: user.tokenVersion },
      { expiresIn: '5m' },
    );
  }

  private async verifyMfaToken(
    token: string,
    purpose: 'mfa_challenge' | 'mfa_enroll',
  ) {
    let payload: { sub?: string; purpose?: string; tv?: number };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET', 'change-me-in-production'),
      });
    } catch {
      throw new UnauthorizedException('MFA step expired. Sign in again.');
    }
    if (!payload.sub || payload.purpose !== purpose) {
      throw new UnauthorizedException('Invalid MFA step token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !canAuthenticateStatus(user.status)) {
      throw new UnauthorizedException('Account not allowed to sign in');
    }
    if (Number(payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('MFA step revoked. Sign in again.');
    }
    return user;
  }

  private async consumeTotpOrRecovery(user: User, code: string) {
    const cleaned = String(code || '').trim();
    if (user.mfaSecretEnc) {
      try {
        const secret = decryptSecret(user.mfaSecretEnc, this.mfaMasterKey());
        if (verifyTotp(secret, cleaned.replace(/\s+/g, ''))) {
          return { via: 'totp' as const };
        }
      } catch (e) {
        this.logger.warn(`MFA decrypt failed: ${String(e)}`);
      }
    }
    const hash = hashRecoveryCode(cleaned);
    const row = await this.prisma.mfaRecoveryCode.findFirst({
      where: { userId: user.id, codeHash: hash, usedAt: null },
    });
    if (!row) {
      throw new UnauthorizedException('Invalid authenticator or recovery code');
    }
    await this.prisma.mfaRecoveryCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { via: 'recovery' as const };
  }

  private async replaceRecoveryCodes(userId: string) {
    const codes = generateRecoveryCodes(10);
    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.mfaRecoveryCode.createMany({
        data: codes.map((c) => ({
          userId,
          codeHash: hashRecoveryCode(c),
        })),
      }),
    ]);
    return codes;
  }

  async mfaStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const policy = await this.resolvePasswordPolicy(user.companyId);
    const unused = await this.prisma.mfaRecoveryCode.count({
      where: { userId, usedAt: null },
    });
    return {
      mfaEnabled: user.mfaEnabled,
      recoveryCodesRemaining: unused,
      companyRequiresMfa: policy.requireMfa,
    };
  }

  async mfaEnrollStart(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }
    const secret = generateTotpSecret();
    const enc = encryptSecret(secret, this.mfaMasterKey());
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: enc, mfaEnabled: false },
    });
    const otpauth = otpauthUrl({ secret, email: user.email });
    let qrCodeDataUrl = '';
    try {
      const QRCode = await import('qrcode');
      qrCodeDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
    } catch (e) {
      this.logger.warn(`QR generate failed: ${String(e)}`);
    }
    return {
      secret,
      otpauthUrl: otpauth,
      qrCodeDataUrl,
      message: 'Scan with an authenticator app, then confirm with a 6-digit code.',
    };
  }

  async mfaEnrollConfirm(userId: string, dto: { code: string; password?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.mfaSecretEnc) {
      throw new BadRequestException('Start MFA enrollment first');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }
    if (dto.password) {
      const ok = await bcrypt.compare(dto.password, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Password is incorrect');
    }
    const secret = decryptSecret(user.mfaSecretEnc, this.mfaMasterKey());
    if (!verifyTotp(secret, dto.code)) {
      throw new BadRequestException('Invalid authenticator code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    const recoveryCodes = await this.replaceRecoveryCodes(userId);
    await this.auditAuth(user.companyId, {
      actorId: user.id,
      actorName: user.email,
      action: 'mfa.enabled',
      entityId: user.id,
    });
    return {
      ok: true,
      mfaEnabled: true,
      recoveryCodes,
      message:
        'MFA enabled. Store these recovery codes securely — they will not be shown again.',
    };
  }

  async mfaDisable(userId: string, dto: { password: string; code: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Password is incorrect');
    await this.consumeTotpOrRecovery(user, dto.code);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecretEnc: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } });
    await this.revokeAllSessionsForUser(userId, 'mfa_disabled');
    await this.auditAuth(user.companyId, {
      actorId: user.id,
      actorName: user.email,
      action: 'mfa.disabled',
      entityId: user.id,
    });
    void this.emitSecurityNotify({
      type: 'security.mfa_disabled',
      to: user.email,
      companyId: user.companyId,
      userId: user.id,
    });
    return { ok: true, mfaEnabled: false };
  }

  async mfaRegenerateRecovery(
    userId: string,
    dto: { password: string; code: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Password is incorrect');
    await this.consumeTotpOrRecovery(user, dto.code);
    const recoveryCodes = await this.replaceRecoveryCodes(userId);
    await this.auditAuth(user.companyId, {
      actorId: user.id,
      actorName: user.email,
      action: 'mfa.recovery_regenerated',
      entityId: user.id,
    });
    return {
      ok: true,
      recoveryCodes,
      message: 'New recovery codes generated. Old codes no longer work.',
    };
  }

  async mfaChallengeLogin(
    dto: { mfaToken: string; code: string },
    meta: RequestMeta = {},
  ) {
    const user = await this.verifyMfaToken(dto.mfaToken, 'mfa_challenge');
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled on this account');
    }
    const used = await this.consumeTotpOrRecovery(user, dto.code);
    const policy = await this.resolvePasswordPolicy(user.companyId);
    await this.recordLogin({
      user,
      success: true,
      reason: used.via === 'recovery' ? 'mfa_recovery' : 'mfa_ok',
      meta,
    });
    return this.issueSession(user, policy, meta);
  }

  async mfaEnrollLoginStart(dto: { mfaToken: string }) {
    const user = await this.verifyMfaToken(dto.mfaToken, 'mfa_enroll');
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }
    const started = await this.mfaEnrollStart(user.id);
    // Re-issue enroll token so FE can confirm after secret is stored
    const mfaToken = await this.signMfaToken(
      await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      'mfa_enroll',
    );
    return { ...started, mfaToken };
  }

  async mfaEnrollLoginConfirm(
    dto: { mfaToken: string; code: string },
    meta: RequestMeta = {},
  ) {
    const user = await this.verifyMfaToken(dto.mfaToken, 'mfa_enroll');
    const result = await this.mfaEnrollConfirm(user.id, { code: dto.code });
    const fresh = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const policy = await this.resolvePasswordPolicy(fresh.companyId);
    await this.recordLogin({
      user: fresh,
      success: true,
      reason: 'mfa_enrolled_login',
      meta,
    });
    const session = await this.issueSession(fresh, policy, meta);
    return { ...session, recoveryCodes: result.recoveryCodes };
  }
}
