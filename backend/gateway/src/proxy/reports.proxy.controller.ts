import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/reports')
export class ReportsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'ACCOUNTING_SERVICE_URL',
      '/reports',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/reports/, '/reports');
    return this.proxy.forward(
      'ACCOUNTING_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
