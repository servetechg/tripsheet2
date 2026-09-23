import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

export type SocketJwtPayload = {
  sub: string;
  companyId?: string | null;
  role?: string;
};

export function verifySocketToken(
  config: ConfigService,
  token: unknown,
): SocketJwtPayload {
  if (typeof token !== 'string' || !token.trim()) {
    throw new UnauthorizedException('Missing socket auth token');
  }
  const secret =
    config.get<string>('JWT_SECRET') || 'change-me-in-production';
  try {
    const payload = jwt.verify(token.trim(), secret) as SocketJwtPayload;
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token subject');
    }
    return payload;
  } catch {
    throw new UnauthorizedException('Invalid or expired socket token');
  }
}

export function inAppUserRoom(userId: string): string {
  return `user:${userId}`;
}
