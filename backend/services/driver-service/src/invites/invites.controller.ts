import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CompleteInviteDto } from './dto/complete-invite.dto';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  findAll(@Query('companyId') companyId?: string) {
    return this.invitesService.findAll(companyId);
  }

  @Post()
  create(@Body() dto: CreateInviteDto) {
    return this.invitesService.create(dto);
  }

  @Get('by-token/:token')
  findByToken(@Param('token') token: string) {
    return this.invitesService.findByToken(token);
  }

  @Post(':token/complete')
  complete(@Param('token') token: string, @Body() dto: CompleteInviteDto) {
    return this.invitesService.complete(token, dto);
  }
}
