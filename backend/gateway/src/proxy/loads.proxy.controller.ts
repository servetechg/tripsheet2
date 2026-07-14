import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/loads')
export class LoadsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'FLEET_SERVICE_URL',
      '/loads',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/loads/, '/loads');
    return this.proxy.forward(
      'FLEET_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
