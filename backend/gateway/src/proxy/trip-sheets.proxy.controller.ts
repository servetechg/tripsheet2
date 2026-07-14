import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/trip-sheets')
export class TripSheetsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All()
  root(@Req() req: Request) {
    return this.proxy.forward(
      'TRIPSHEET_SERVICE_URL',
      '/trip-sheets',
      req.method as Method,
      req,
    );
  }

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(/^\/api\/trip-sheets/, '/trip-sheets');
    return this.proxy.forward(
      'TRIPSHEET_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
