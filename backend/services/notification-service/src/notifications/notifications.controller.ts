import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SmsService } from '../sms/sms.service';
import { SendSmsDto } from '../sms/dto/send-sms.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly smsService: SmsService,
  ) {}

  @Post('sms')
  sendSms(@Body() dto: SendSmsDto) {
    return this.smsService.send(dto);
  }

  @Get('health/detail')
  healthDetail() {
    return this.notificationsService.getHealthDetail();
  }

  @Get()
  findAll(
    @Query('companyId') companyId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.notificationsService.findAll(companyId, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(id);
  }
}
