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
import { JwtAuthGuard } from './jwt-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user?: { sub: string } }) {
    return this.authService.me(req.user!.sub);
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  listUsers(@Query('companyId') companyId?: string) {
    return this.authService.listUsers(companyId);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.authService.updateUser(id, dto);
  }
}
