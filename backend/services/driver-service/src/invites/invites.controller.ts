import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';
import { SendInviteDto } from './dto/send-invite.dto';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  findAll(@Query('companyId') companyId?: string) {
    return this.invitesService.findAll(companyId);
  }

  @Post()
  create(
    @Body() dto: CreateInviteDto,
    @Headers('x-user-email') actorEmail?: string,
  ) {
    return this.invitesService.create(dto, actorEmail);
  }

  @Get('by-token/:token')
  findByToken(@Param('token') token: string) {
    return this.invitesService.findByToken(token);
  }

  @Post(':token/complete')
  complete(@Param('token') token: string, @Body() dto: CompleteInviteDto) {
    return this.invitesService.complete(token, dto);
  }

  @Post(':id/send')
  send(
    @Param('id') id: string,
    @Body() dto: SendInviteDto,
    @Headers('x-user-email') actorEmail?: string,
  ) {
    return this.invitesService.sendLink(id, dto, actorEmail);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string) {
    return this.invitesService.revoke(id);
  }

  @Post(':id/regenerate')
  regenerate(@Param('id') id: string) {
    return this.invitesService.regenerate(id);
  }
}
