import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/qualifications')
export class QualificationsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      '/qualifications',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/qualifications/, '/qualifications');
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
