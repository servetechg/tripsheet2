import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/assets')
export class AssetsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'FLEET_SERVICE_URL',
      '/assets',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/assets/, '/assets');
    return this.proxy.forward(
      'FLEET_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
