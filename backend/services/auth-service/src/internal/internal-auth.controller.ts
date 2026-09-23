import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import { UpdateUserDto } from '../auth/dto/update-user.dto';

/**
 * Service-to-service only (driver-service / gateway → auth-service).
 * Not under /auth so the gateway does not expose these routes.
 */
@Controller('internal')
export class InternalAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('users')
  createOrGetUser(
    @Headers('x-internal-api-key') key: string | undefined,
    @Body() dto: CreateUserDto,
  ) {
    this.assertKey(key);
    return this.authService.createUserOrGet(dto);
  }

  @Get('users/:id/session')
  session(
    @Param('id') id: string,
    @Headers('x-internal-api-key') key: string | undefined,
    @Query('sid') sid?: string,
  ) {
    this.assertKey(key);
    return this.authService.getSessionSnapshot(id, sid);
  }

  @Post('security-events')
  securityEvent(
    @Headers('x-internal-api-key') key: string | undefined,
    @Body()
    body: {
      type: string;
      to: string;
      companyId?: string;
      userId?: string;
      detail?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    this.assertKey(key);
    return this.authService.ingestSecurityNotify(body);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Headers('x-internal-api-key') key: string | undefined,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    this.assertKey(key);
    const dto: UpdateUserDto = { status: body.status as UpdateUserDto['status'] };
    return this.authService.updateUser(id, dto, {
      id: 'internal',
      email: 'driver-service@internal',
      role: 'system',
    });
  }

  /** Invite guard — lookup auth user by email (service-to-service). */
  @Get('users/lookup')
  lookupUserByEmail(
    @Headers('x-internal-api-key') key: string | undefined,
    @Query('email') email?: string,
  ) {
    this.assertKey(key);
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new BadRequestException('email query parameter is required');
    }
    return this.authService.lookupUserByEmail(normalized);
  }

  /** Primary outbound sender for a tenant (company owner / first admin). */
  @Get('companies/:companyId/sender-email')
  companySenderEmail(
    @Headers('x-internal-api-key') key: string | undefined,
    @Param('companyId') companyId: string,
  ) {
    this.assertKey(key);
    return this.authService.getCompanySenderEmail(companyId);
  }

  @Get('companies/:companyId/notify-recipients')
  companyNotifyRecipients(
    @Headers('x-internal-api-key') key: string | undefined,
    @Param('companyId') companyId: string,
  ) {
    this.assertKey(key);
    return this.authService.listCompanyNotifyRecipients(companyId);
  }

  private assertKey(key: string | undefined) {
    const expected =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }
}
