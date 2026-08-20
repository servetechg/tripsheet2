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
    return this.authService.changePassword(req.user!.sub!, dto);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() req: Request & { user?: JwtActor }) {
    return this.authService.logoutAllSessions(req.user!.sub!);
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
  ) {
    assertActorHas(req.user, 'users.view');
    const role = req.user?.role;
    if (role && role !== 'superadmin') {
      return this.authService.listUsers(req.user?.companyId || undefined);
    }
    return this.authService.listUsers(companyId);
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
    });
  }
}
