import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/notifications')
export class NotificationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'NOTIFICATION_SERVICE_URL',
      '/notifications',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(
      /^\/api\/notifications/,
      '/notifications',
    );
    return this.proxy.forward(
      'NOTIFICATION_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
