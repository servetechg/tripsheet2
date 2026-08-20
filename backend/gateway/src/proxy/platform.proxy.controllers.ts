import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/plans')
export class PlansProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'COMPANY_SERVICE_URL',
      '/plans',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/plans/, '/plans');
    return this.proxy.forward(
      'COMPANY_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}

@Controller('api/tenants')
export class TenantsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'COMPANY_SERVICE_URL',
      '/tenants',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/tenants/, '/tenants');
    return this.proxy.forward(
      'COMPANY_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
