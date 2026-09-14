import {
  Body,
  Controller,
  Headers,
  Param,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DriversService } from '../drivers/drivers.service';

@Controller('internal')
export class InternalDriverController {
  constructor(
    private readonly drivers: DriversService,
    private readonly config: ConfigService,
  ) {}

  @Patch('users/:userId/email')
  syncUserEmail(
    @Headers('x-internal-api-key') key: string | undefined,
    @Param('userId') userId: string,
    @Body() body: { email?: string },
  ) {
    this.assertKey(key);
    return this.drivers.syncEmailByUserId(userId, String(body.email || ''));
  }

  private assertKey(key: string | undefined) {
    const expected =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }
}
