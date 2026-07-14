import { Injectable, HttpException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig, Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';

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
    if (req.headers.authorization) {
      headers.authorization = String(req.headers.authorization);
    }
    if (req.headers['content-type']) {
      headers['content-type'] = String(req.headers['content-type']);
    }

    const config: AxiosRequestConfig = {
      method,
      url,
      headers,
      params: req.query,
      data: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : req.body,
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
      return {
        message: 'not implemented',
        detail: 'Upstream service unavailable or not ready',
        target: url,
      };
    }
  }
}
