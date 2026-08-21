import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/forgot-password.dto';
import {
  LogoutDto,
  PatchSessionDto,
  RefreshTokenDto,
} from './dto/session.dto';
import {
  MfaChallengeDto,
  MfaDisableDto,
  MfaEnrollConfirmDto,
  MfaEnrollLoginConfirmDto,
  MfaEnrollLoginStartDto,
} from './dto/mfa.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';
import { RbacService } from '../rbac/rbac.service';
import { assertActorHas, type JwtActor } from '../rbac/actor';
import { normalizeRoleCode } from '../rbac/rbac.catalog';
import { ForbiddenException } from '@nestjs/common';

function requestMeta(req: Request): { ip: string; userAgent: string } {
  const fwd = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return {
    ip: fwd || req.socket?.remoteAddress || '',
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rbac: RbacService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestMeta(req));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refreshSession(dto, requestMeta(req));
  }

  @Post('mfa/challenge')
  mfaChallenge(@Body() dto: MfaChallengeDto, @Req() req: Request) {
    return this.authService.mfaChallengeLogin(dto, requestMeta(req));
  }

  @Post('mfa/enroll-login/start')
  mfaEnrollLoginStart(@Body() dto: MfaEnrollLoginStartDto) {
    return this.authService.mfaEnrollLoginStart(dto);
  }

  @Post('mfa/enroll-login/confirm')
  mfaEnrollLoginConfirm(
    @Body() dto: MfaEnrollLoginConfirmDto,
    @Req() req: Request,
  ) {
    return this.authService.mfaEnrollLoginConfirm(dto, requestMeta(req));
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  mfaStatus(@Req() req: Request & { user?: JwtActor }) {
    return this.authService.mfaStatus(req.user!.sub!);
  }

  @Post('mfa/enroll/start')
  @UseGuards(JwtAuthGuard)
  mfaEnrollStart(@Req() req: Request & { user?: JwtActor }) {
    return this.authService.mfaEnrollStart(req.user!.sub!);
  }

  @Post('mfa/enroll/confirm')
  @UseGuards(JwtAuthGuard)
  mfaEnrollConfirm(
    @Req() req: Request & { user?: JwtActor },
    @Body() dto: MfaEnrollConfirmDto,
  ) {
    return this.authService.mfaEnrollConfirm(req.user!.sub!, dto);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  mfaDisable(
    @Req() req: Request & { user?: JwtActor },
    @Body() dto: MfaDisableDto,
  ) {
    return this.authService.mfaDisable(req.user!.sub!, dto);
  }

  @Post('mfa/recovery/regenerate')
  @UseGuards(JwtAuthGuard)
  mfaRegenerateRecovery(
    @Req() req: Request & { user?: JwtActor },
    @Body() dto: MfaDisableDto,
  ) {
    return this.authService.mfaRegenerateRecovery(req.user!.sub!, dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, requestMeta(req));
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(dto, requestMeta(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user?: { sub: string } }) {
    return this.authService.me(req.user!.sub);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() req: Request & { user?: JwtActor },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user!.sub!,
      dto,
      requestMeta(req),
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @Req() req: Request & { user?: JwtActor & { sid?: string } },
    @Body() dto: LogoutDto,
  ) {
    return this.authService.logoutCurrent(
      req.user!.sub!,
      dto,
      req.user?.sid,
    );
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() req: Request & { user?: JwtActor }) {
    return this.authService.logoutAllSessions(req.user!.sub!);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@Req() req: Request & { user?: JwtActor & { sid?: string } }) {
    return this.authService.listSessions(req.user!.sub!, req.user?.sid);
  }

  @Get('sessions/history')
  @UseGuards(JwtAuthGuard)
  sessionHistory(
    @Req() req: Request & { user?: JwtActor },
    @Query('limit') limit?: string,
  ) {
    return this.authService.sessionHistory(
      req.user!.sub!,
      limit ? Number(limit) : 40,
    );
  }

  @Patch('sessions/:id')
  @UseGuards(JwtAuthGuard)
  patchSession(
    @Req() req: Request & { user?: JwtActor },
    @Param('id') id: string,
    @Body() dto: PatchSessionDto,
  ) {
    return this.authService.patchSession(req.user!.sub!, id, dto);
  }

  @Post('sessions/:id/revoke')
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @Req() req: Request & { user?: JwtActor },
    @Param('id') id: string,
  ) {
    return this.authService.revokeSession(req.user!.sub!, id);
  }

  @Get('login-history')
  @UseGuards(JwtAuthGuard)
  loginHistory(
    @Req() req: Request & { user?: JwtActor },
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('scope') scope?: string,
    @Query('companyId') companyId?: string,
  ) {
    if (scope === 'company') {
      return this.authService.listCompanyLoginHistory(req.user, {
        limit: limit ? Number(limit) : 100,
        companyId,
      });
    }
    return this.authService.listLoginHistory(req.user, {
      userId,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('security-events')
  @UseGuards(JwtAuthGuard)
  securityEvents(
    @Req() req: Request & { user?: JwtActor },
    @Query('limit') limit?: string,
    @Query('scope') scope?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.authService.listSecurityEvents(req.user, {
      limit: limit ? Number(limit) : 40,
      scope: scope === 'company' ? 'company' : 'self',
      companyId,
    });
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  createUser(
    @Req() req: Request & { user?: JwtActor },
    @Body() dto: CreateUserDto,
  ) {
    assertActorHas(req.user, 'users.create');
    const role = normalizeRoleCode(dto.role);
    if (role === 'superadmin' && req.user?.role !== 'superadmin') {
      throw new ForbiddenException('Cannot create a Super Admin');
    }
    if (role !== 'driver') {
      assertActorHas(req.user, 'users.assign_role');
    }
    return this.authService.createUser(dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  listUsers(
    @Req() req: Request & { user?: JwtActor },
    @Query('companyId') companyId?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    assertActorHas(req.user, 'users.view');
    const withArchived =
      includeArchived === '1' || includeArchived === 'true';
    const role = req.user?.role;
    if (role && role !== 'superadmin') {
      return this.authService.listUsers(req.user?.companyId || undefined, {
        includeArchived: withArchived,
      });
    }
    return this.authService.listUsers(companyId, {
      includeArchived: withArchived,
    });
  }

  @Get('roles')
  @UseGuards(JwtAuthGuard)
  listRoles() {
    return this.rbac.listRoles();
  }

  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard)
  updateUser(
    @Req() req: Request & { user?: JwtActor },
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    assertActorHas(req.user, 'users.edit');
    if (dto.password && req.user?.sub !== id) {
      assertActorHas(req.user, 'users.reset_password');
    }
    if (dto.status !== undefined) {
      assertActorHas(req.user, 'users.suspend');
    }
    if (dto.role || dto.customRoleId !== undefined) {
      assertActorHas(req.user, 'users.assign_role');
      if (
        dto.role &&
        normalizeRoleCode(dto.role) === 'superadmin' &&
        req.user?.role !== 'superadmin'
      ) {
        throw new ForbiddenException('Cannot assign Super Admin');
      }
    }
    return this.authService.updateUser(id, dto, {
      id: req.user?.sub,
      email: req.user?.email,
      role: req.user?.role,
    });
  }

  @Post('users/:id/unlock')
  @UseGuards(JwtAuthGuard)
  unlockUser(
    @Req() req: Request & { user?: JwtActor },
    @Param('id') id: string,
  ) {
    assertActorHas(req.user, 'users.suspend');
    return this.authService.unlockUser(id, {
      id: req.user?.sub,
      email: req.user?.email,
      role: req.user?.role,
    });
  }
}
