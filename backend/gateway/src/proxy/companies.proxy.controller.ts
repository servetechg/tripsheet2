import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/companies')
export class CompaniesProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'COMPANY_SERVICE_URL',
      '/companies',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/companies/, '/companies');
    return this.proxy.forward(
      'COMPANY_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
