import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/auth')
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward('AUTH_SERVICE_URL', '/auth', req.method as Method, req);
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/auth/, '/auth');
    return this.proxy.forward(
      'AUTH_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
