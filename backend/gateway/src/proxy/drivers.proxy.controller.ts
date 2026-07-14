import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/drivers')
export class DriversProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      '/drivers',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/drivers/, '/drivers');
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
