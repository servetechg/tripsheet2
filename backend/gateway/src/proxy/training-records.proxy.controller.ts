import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/training-records')
export class TrainingRecordsProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  forward(@Req() req: Request) {
    const upstream = req.path.replace(
      /^\/api\/training-records/,
      '/training-records',
    );
    return this.proxy.forward(
      'DRIVER_SERVICE_URL',
      upstream,
      req.method as Method,
      req,
    );
  }
}
