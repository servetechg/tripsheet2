import { All, Controller, Req } from '@nestjs/common';
import { Request } from 'express';
import { Method } from 'axios';
import { ProxyService } from './proxy.service';

@Controller('api/maintenance')
export class MaintenanceProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('FLEET_SERVICE_URL', '/maintenance', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('FLEET_SERVICE_URL', req.path.replace(/^\/api\/maintenance/, '/maintenance'), req.method as Method, req);
  }
}

@Controller('api/dvir')
export class DvirProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('FLEET_SERVICE_URL', '/dvir', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('FLEET_SERVICE_URL', req.path.replace(/^\/api\/dvir/, '/dvir'), req.method as Method, req);
  }
}

@Controller('api/invoices')
export class InvoicesProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', '/invoices', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', req.path.replace(/^\/api\/invoices/, '/invoices'), req.method as Method, req);
  }
}

@Controller('api/bills')
export class BillsProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', '/bills', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', req.path.replace(/^\/api\/bills/, '/bills'), req.method as Method, req);
  }
}

@Controller('api/payments')
export class PaymentsProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', '/payments', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', req.path.replace(/^\/api\/payments/, '/payments'), req.method as Method, req);
  }
}

@Controller('api/accounts')
export class AccountsProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', '/accounts', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('ACCOUNTING_SERVICE_URL', req.path.replace(/^\/api\/accounts/, '/accounts'), req.method as Method, req);
  }
}

@Controller('api/messages')
export class MessagesProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('NOTIFICATION_SERVICE_URL', '/messages', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('NOTIFICATION_SERVICE_URL', req.path.replace(/^\/api\/messages/, '/messages'), req.method as Method, req);
  }
}

@Controller('api/comments')
export class CommentsProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('NOTIFICATION_SERVICE_URL', '/comments', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('NOTIFICATION_SERVICE_URL', req.path.replace(/^\/api\/comments/, '/comments'), req.method as Method, req);
  }
}

@Controller('api/audit')
export class AuditProxyController {
  constructor(private readonly proxy: ProxyService) {}
  @All() root(@Req() req: Request) {
    return this.proxy.forward('COMPANY_SERVICE_URL', '/audit', req.method as Method, req);
  }
  @All('*path') forward(@Req() req: Request) {
    return this.proxy.forward('COMPANY_SERVICE_URL', req.path.replace(/^\/api\/audit/, '/audit'), req.method as Method, req);
  }
}
