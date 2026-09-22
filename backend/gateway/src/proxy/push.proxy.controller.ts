import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/push')
export class PushProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'NOTIFICATION_SERVICE_URL',
      '/push',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/push/, '/push');
    return this.proxy.forward(
      'NOTIFICATION_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
