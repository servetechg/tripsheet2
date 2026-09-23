import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InAppNotificationsService } from './in-app-notifications.service';

@Controller('in-app-notifications')
export class InAppNotificationsController {
  constructor(
    private readonly inbox: InAppNotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(
    @Query('limit', new DefaultValuePipe(40), ParseIntPipe) limit: number,
  ) {
    return this.inbox.listMine(limit);
  }

  @Post('read-all')
  markAllRead() {
    return this.inbox.markAllRead();
  }

  /** Service-to-service (fleet-service, etc.) — same key as /push/send. */
  @Post('internal/notify')
  internalNotify(
    @Headers('x-internal-api-key') key: string | undefined,
    @Body()
    body: {
      companyId: string;
      userId: string;
      title: string;
      body: string;
      link?: string | null;
      type?: string;
    },
  ) {
    this.assertInternalKey(key);
    return this.inbox.notifyUser(body);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.inbox.markRead(id);
  }

  private assertInternalKey(key: string | undefined): void {
    const expected =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }
}