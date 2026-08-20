import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice(7);
    let payload: { sub?: string; tv?: number };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET', 'change-me-in-production'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const row = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, lockedUntil: true },
    });
    if (!row) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }
    const tv = Number(payload.tv ?? 0);
    if (row.tokenVersion !== tv) {
      throw new UnauthorizedException('Token revoked. Sign in again.');
    }

    (request as Request & { user?: unknown }).user = payload;
    return true;
  }
}
