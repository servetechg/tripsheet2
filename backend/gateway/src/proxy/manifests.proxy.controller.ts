import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/manifests')
export class ManifestsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'MANIFEST_SERVICE_URL',
      '/manifests',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/manifests/, '/manifests');
    return this.proxy.forward(
      'MANIFEST_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
