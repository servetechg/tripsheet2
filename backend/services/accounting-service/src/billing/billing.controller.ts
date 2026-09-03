import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('accounts')
  listAccounts(@Query('companyId') companyId?: string) {
    return this.billing.listAccounts(companyId);
  }

  @Post('accounts')
  upsertAccount(@Body() body: Record<string, unknown>) {
    return this.billing.upsertAccount(body);
  }

  @Post('accounts/seed-defaults')
  seedAccounts(@Body() body: { companyId: string }) {
    return this.billing.seedDefaultAccounts(body.companyId);
  }

  @Get('invoices')
  listInvoices(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.billing.listInvoices(companyId, status);
  }

  @Post('invoices')
  createInvoice(@Body() body: Record<string, unknown>) {
    return this.billing.createInvoice(body);
  }

  @Patch('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.billing.updateInvoice(id, body);
  }

  @Delete('invoices/:id')
  removeInvoice(@Param('id') id: string) {
    return this.billing.removeInvoice(id);
  }

  @Get('bills')
  listBills(
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
  ) {
    return this.billing.listBills(companyId, status);
  }

  @Post('bills')
  createBill(@Body() body: Record<string, unknown>) {
    return this.billing.createBill(body);
  }

  @Patch('bills/:id')
  updateBill(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.billing.updateBill(id, body);
  }

  @Delete('bills/:id')
  removeBill(@Param('id') id: string) {
    return this.billing.removeBill(id);
  }

  @Get('payments')
  listPayments(@Query('companyId') companyId?: string) {
    return this.billing.listPayments(companyId);
  }

  @Post('payments')
  createPayment(@Body() body: Record<string, unknown>) {
    return this.billing.createPayment(body);
  }
}
