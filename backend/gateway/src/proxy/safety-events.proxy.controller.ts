import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/safety-events')
export class SafetyEventsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/safety-events/, '/safety-events');
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
