import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/invites')
export class InvitesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      '/invites',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/invites/, '/invites');
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
