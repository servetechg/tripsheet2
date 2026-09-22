import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PushService } from './push.service';
import {
  RegisterPushDto,
  SendPushDto,
  UnregisterPushDto,
} from './dto/push.dto';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('status')
  status() {
    return this.push.status();
  }

  @Post('register')
  register(@Body() dto: RegisterPushDto, @Req() req: Request) {
    const ua = req.headers['user-agent'];
    return this.push.register(
      dto,
      typeof ua === 'string' ? ua : undefined,
    );
  }

  @Delete('register')
  unregisterDelete(@Body() dto: UnregisterPushDto) {
    return this.push.unregister(dto);
  }

  @Post('unregister')
  unregisterPost(@Body() dto: UnregisterPushDto) {
    return this.push.unregister(dto);
  }

  @Post('test')
  test() {
    return this.push.sendTestToCurrentUser();
  }

  @Post('send')
  sendInternal(
    @Headers('x-internal-api-key') key: string | undefined,
    @Body() dto: SendPushDto,
  ) {
    this.push.assertInternalKey(key);
    return this.push.sendToUser(dto);
  }
}
