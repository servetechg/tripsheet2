import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller()
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('messages')
  listMessages(
    @Query('companyId') companyId?: string,
    @Query('toUserId') toUserId?: string,
  ) {
    return this.messaging.listMessages(companyId, toUserId);
  }

  @Post('messages')
  createMessage(@Body() body: Record<string, unknown>) {
    return this.messaging.createMessage(body);
  }

  @Patch('messages/:id/read')
  markRead(@Param('id') id: string) {
    return this.messaging.markRead(id);
  }

  @Get('comments')
  listComments(
    @Query('companyId') companyId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.messaging.listComments(companyId, entityType, entityId);
  }

  @Post('comments')
  createComment(@Body() body: Record<string, unknown>) {
    return this.messaging.createComment(body);
  }
}
