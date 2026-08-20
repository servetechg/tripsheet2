import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from '../auth/dto/create-user.dto';

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
  ) {
    this.assertKey(key);
    return this.authService.getSessionSnapshot(id);
  }

  private assertKey(key: string | undefined) {
    const expected =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }
}
