import { Injectable, HttpException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig, Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';

const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'x-user-id',
  'x-user-role',
  'x-user-email',
  'x-user-permissions',
  'x-driver-id',
  'x-company-id',
  'x-tenant-key',
  'x-tenant-status',
  'x-tenant-routing',
  'x-tenant-db-name',
  'x-internal-api-key',
] as const;

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  getBaseUrl(serviceKey: string): string {
    const url = this.config.get<string>(serviceKey);
    if (!url) {
      throw new HttpException(`Missing config: ${serviceKey}`, 500);
    }
    return url.replace(/\/$/, '');
  }

  async forward(
    serviceKey: string,
    path: string,
    method: Method,
    req: Request,
  ): Promise<unknown> {
    const base = this.getBaseUrl(serviceKey);
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    const headers: Record<string, string> = {};
    for (const name of FORWARD_HEADERS) {
      const v = req.headers[name];
      if (v) headers[name] = Array.isArray(v) ? v[0] : String(v);
    }

    // Non-superadmin: never let client override companyId via query
    const role = headers['x-user-role'];
    const companyId = headers['x-company-id'];
    const params = { ...(req.query as Record<string, unknown>) };
    if (role && role !== 'superadmin' && companyId) {
      params.companyId = companyId;
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      headers,
      params,
      data: ['GET', 'HEAD'].includes(method.toUpperCase())
        ? undefined
        : req.body,
      validateStatus: () => true,
    };

    try {
      const response = await firstValueFrom(this.http.request(config));
      if (response.status >= 400) {
        throw new HttpException(
          response.data ?? { message: 'Upstream error' },
          response.status,
        );
      }
      return response.data;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.warn(`Proxy failed ${method} ${url}: ${String(err)}`);
      throw new HttpException(
        {
          message: 'Upstream service unavailable',
          detail: 'Upstream service unavailable or not ready',
          target: url,
        },
        503,
      );
    }
  }
}
