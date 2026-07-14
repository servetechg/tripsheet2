import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: this.toPublicUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  async createUser(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name,
        role: dto.role,
        companyId: dto.companyId ?? null,
      },
    });

    return this.toPublicUser(user);
  }

  async listUsers(companyId?: string) {
    const users = await this.prisma.user.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    return users.map((u) => this.toPublicUser(u));
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.companyId !== undefined) data.companyId = dto.companyId;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined && dto.password.length > 0) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return this.toPublicUser(user);
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
