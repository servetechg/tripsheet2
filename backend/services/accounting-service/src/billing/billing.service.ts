import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Chart of accounts ---
  listAccounts(companyId?: string) {
    return this.prisma.ledgerAccount.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { code: 'asc' },
    });
  }

  async upsertAccount(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const code = String(body.code || '');
    const name = String(body.name || '');
    const type = String(body.type || 'expense');
    if (!companyId || !code || !name) {
      throw new BadRequestException('companyId, code, and name are required');
    }
    return this.prisma.ledgerAccount.upsert({
      where: { companyId_code: { companyId, code } },
      update: { name, type, active: body.active !== false },
      create: { companyId, code, name, type, active: body.active !== false },
    });
  }

  async seedDefaultAccounts(companyId: string) {
    const defaults = [
      { code: '1000', name: 'Cash', type: 'asset' },
      { code: '1100', name: 'Accounts Receivable', type: 'asset' },
      { code: '2000', name: 'Accounts Payable', type: 'liability' },
      { code: '4000', name: 'Freight Revenue', type: 'revenue' },
      { code: '5000', name: 'Fuel Expense', type: 'expense' },
      { code: '5100', name: 'Driver Pay', type: 'expense' },
      { code: '5200', name: 'Maintenance', type: 'expense' },
    ];
    for (const row of defaults) {
      await this.upsertAccount({ companyId, ...row });
    }
    return this.listAccounts(companyId);
  }

  // --- Invoices ---
  listInvoices(companyId?: string, status?: string) {
    return this.prisma.invoice.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const customerName = String(body.customerName || '');
    const issueDate = String(body.issueDate || '');
    const dueDate = String(body.dueDate || '');
    if (!companyId || !customerName || !issueDate || !dueDate) {
      throw new BadRequestException(
        'companyId, customerName, issueDate, and dueDate are required',
      );
    }
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const subtotal = lines.reduce(
      (s: number, l: any) => s + Number(l.amount || 0),
      0,
    );
    const tax = Number(body.tax || 0);
    const total = subtotal + tax;
    return this.prisma.invoice.create({
      data: {
        companyId,
        customerName,
        customerId: body.customerId ? String(body.customerId) : null,
        brokerName: String(body.brokerName || ''),
        brokerId: body.brokerId ? String(body.brokerId) : null,
        loadId: body.loadId ? String(body.loadId) : null,
        tripNo: String(body.tripNo || ''),
        status: String(body.status || 'draft'),
        issueDate,
        dueDate,
        currency: String(body.currency || 'CAD'),
        subtotal,
        tax,
        total,
        amountPaid: 0,
        lines: lines as object,
        notes: String(body.notes || ''),
      },
    });
  }

  async updateInvoice(id: string, body: Record<string, unknown>) {
    await this.ensureInvoice(id);
    const data: Record<string, unknown> = {};
    for (const key of [
      'customerName',
      'customerId',
      'brokerName',
      'tripNo',
      'status',
      'issueDate',
      'dueDate',
      'currency',
      'notes',
    ]) {
      if (body[key] !== undefined) data[key] = String(body[key]);
    }
    if (body.loadId !== undefined) {
      data.loadId = body.loadId ? String(body.loadId) : null;
    }
    if (body.brokerId !== undefined) {
      data.brokerId = body.brokerId ? String(body.brokerId) : null;
    }
    if (body.lines !== undefined) {
      const lines = Array.isArray(body.lines) ? body.lines : [];
      const subtotal = lines.reduce(
        (s: number, l: any) => s + Number(l.amount || 0),
        0,
      );
      const tax = Number(body.tax ?? 0);
      data.lines = lines as object;
      data.subtotal = subtotal;
      data.tax = tax;
      data.total = subtotal + tax;
    } else if (body.tax !== undefined) {
      data.tax = Number(body.tax);
    }
    return this.prisma.invoice.update({ where: { id }, data: data as any });
  }

  async removeInvoice(id: string) {
    await this.ensureInvoice(id);
    return this.prisma.invoice.delete({ where: { id } });
  }

  // --- Bills ---
  listBills(companyId?: string, status?: string) {
    return this.prisma.bill.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBill(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const vendorName = String(body.vendorName || '');
    const issueDate = String(body.issueDate || '');
    const dueDate = String(body.dueDate || '');
    if (!companyId || !vendorName || !issueDate || !dueDate) {
      throw new BadRequestException(
        'companyId, vendorName, issueDate, and dueDate are required',
      );
    }
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const total = lines.reduce(
      (s: number, l: any) => s + Number(l.amount || 0),
      Number(body.total || 0) || 0,
    );
    return this.prisma.bill.create({
      data: {
        companyId,
        vendorName,
        status: String(body.status || 'open'),
        issueDate,
        dueDate,
        currency: String(body.currency || 'CAD'),
        total: total || Number(body.total || 0),
        amountPaid: 0,
        lines: lines as object,
        notes: String(body.notes || ''),
      },
    });
  }

  async updateBill(id: string, body: Record<string, unknown>) {
    await this.ensureBill(id);
    return this.prisma.bill.update({
      where: { id },
      data: {
        vendorName:
          body.vendorName !== undefined ? String(body.vendorName) : undefined,
        status: body.status !== undefined ? String(body.status) : undefined,
        issueDate:
          body.issueDate !== undefined ? String(body.issueDate) : undefined,
        dueDate: body.dueDate !== undefined ? String(body.dueDate) : undefined,
        total: body.total !== undefined ? Number(body.total) : undefined,
        notes: body.notes !== undefined ? String(body.notes) : undefined,
        lines: body.lines !== undefined ? (body.lines as object) : undefined,
      },
    });
  }

  async removeBill(id: string) {
    await this.ensureBill(id);
    return this.prisma.bill.delete({ where: { id } });
  }

  // --- Payments ---
  listPayments(companyId?: string) {
    return this.prisma.payment.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPayment(body: Record<string, unknown>) {
    const companyId = String(body.companyId || '');
    const direction = String(body.direction || '');
    const partyName = String(body.partyName || '');
    const amount = Number(body.amount || 0);
    const paidAt = String(body.paidAt || '');
    if (!companyId || !direction || !partyName || !amount || !paidAt) {
      throw new BadRequestException(
        'companyId, direction, partyName, amount, and paidAt are required',
      );
    }
    const payment = await this.prisma.payment.create({
      data: {
        companyId,
        direction,
        partyName,
        invoiceId: body.invoiceId ? String(body.invoiceId) : null,
        billId: body.billId ? String(body.billId) : null,
        amount,
        method: String(body.method || 'ach'),
        paidAt,
        reference: String(body.reference || ''),
        notes: String(body.notes || ''),
      },
    });

    if (payment.invoiceId) {
      const inv = await this.prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
      });
      if (inv) {
        const amountPaid = inv.amountPaid + amount;
        const status =
          amountPaid >= inv.total
            ? 'paid'
            : amountPaid > 0
              ? 'partial'
              : inv.status;
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { amountPaid, status },
        });
      }
    }
    if (payment.billId) {
      const bill = await this.prisma.bill.findUnique({
        where: { id: payment.billId },
      });
      if (bill) {
        const amountPaid = bill.amountPaid + amount;
        const status =
          amountPaid >= bill.total
            ? 'paid'
            : amountPaid > 0
              ? 'partial'
              : bill.status;
        await this.prisma.bill.update({
          where: { id: bill.id },
          data: { amountPaid, status },
        });
      }
    }
    return payment;
  }

  private async ensureInvoice(id: string) {
    const row = await this.prisma.invoice.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Invoice ${id} not found`);
    return row;
  }

  private async ensureBill(id: string) {
    const row = await this.prisma.bill.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Bill ${id} not found`);
    return row;
  }
}
