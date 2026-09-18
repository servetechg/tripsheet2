import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getTenantStore } from '@tripsheet/tenant-runtime';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantSchemaRetry } from '../prisma/tenant-schema-errors';
import {
  AnalyticsReport,
  AssetRecord,
  CompanyReportSummary,
  ExpenseRecord,
  LoadRecord,
  MaintenanceRecord,
  TripSheetRecord,
} from './reports.types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(companyId: string): Promise<CompanyReportSummary> {
    try {
      return await this.buildSummary(companyId);
    } catch (e) {
      this.logger.error(`getSummary failed companyId=${companyId}`, e);
      throw this.asReportsUnavailable(e);
    }
  }

  async getAnalytics(companyId: string): Promise<AnalyticsReport> {
    try {
      return await this.buildAnalytics(companyId);
    } catch (e) {
      this.logger.error(`getAnalytics failed companyId=${companyId}`, e);
      throw this.asReportsUnavailable(e);
    }
  }

  private asReportsUnavailable(cause: unknown): ServiceUnavailableException {
    const msg = String((cause as Error)?.message || cause || '');
    const schemaHint =
      /does not exist|Unknown table|relation .* does not exist|P2021/i.test(
        msg,
      );
    return new ServiceUnavailableException(
      schemaHint
        ? 'Reports database schema is out of date for this company. Run POST /tenants/schema-migrate-all on company-service (staging deploy does this after migrate).'
        : 'Reports data is temporarily unavailable. Check accounting-service logs.',
    );
  }

  private async buildSummary(companyId: string): Promise<CompanyReportSummary> {
    const fleetUrl = this.config.get<string>(
      'FLEET_SERVICE_URL',
      'http://localhost:3004',
    );
    const tripsheetUrl = this.config.get<string>(
      'TRIPSHEET_SERVICE_URL',
      'http://localhost:3006',
    );

    const [loads, assets, tripSheets, settlements] = await Promise.all([
      this.fetchJson<LoadRecord[]>(`${fleetUrl}/loads`, { companyId }, companyId),
      this.fetchJson<AssetRecord[]>(`${fleetUrl}/assets`, { companyId }, companyId),
      this.fetchJson<TripSheetRecord[]>(
        `${tripsheetUrl}/trip-sheets`,
        { companyId },
        companyId,
      ),
      withTenantSchemaRetry(companyId, 'reports.settlements', () =>
        this.prisma.settlement.findMany({ where: { companyId } }),
      ),
    ]);

    const driverIds = new Set<string>();
    for (const load of loads) {
      if (load.driverId) driverIds.add(load.driverId);
    }
    for (const settlement of settlements) {
      if (settlement.driverId) driverIds.add(settlement.driverId);
    }

    const loadCounts = {
      total: loads.length,
      assigned: 0,
      inTransit: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const load of loads) {
      switch (load.status) {
        case 'assigned':
          loadCounts.assigned++;
          break;
        case 'in_transit':
          loadCounts.inTransit++;
          break;
        case 'delivered':
          loadCounts.delivered++;
          break;
        case 'cancelled':
          loadCounts.cancelled++;
          break;
      }
    }

    let trucks = 0;
    let trailers = 0;
    let activeAssets = 0;
    for (const asset of assets) {
      if (asset.type === 'truck') trucks++;
      else if (asset.type === 'trailer') trailers++;
      if (asset.status === 'active') activeAssets++;
    }

    let expenseTotal = 0;
    for (const sheet of tripSheets) {
      expenseTotal += this.sumExpenses(sheet.expenses);
    }

    const settlementCounts = {
      draft: 0,
      approved: 0,
      paid: 0,
      paidAmount: 0,
    };
    for (const settlement of settlements) {
      switch (settlement.status) {
        case 'draft':
          settlementCounts.draft++;
          break;
        case 'approved':
          settlementCounts.approved++;
          break;
        case 'paid':
          settlementCounts.paid++;
          settlementCounts.paidAmount += settlement.totalAmount;
          break;
      }
    }

    return {
      companyId,
      generatedAt: new Date().toISOString(),
      loads: loadCounts,
      fleet: { trucks, trailers, activeAssets },
      drivers: driverIds.size,
      tripSheets: tripSheets.length,
      expenseTotal,
      settlements: settlementCounts,
    };
  }

  private async buildAnalytics(companyId: string): Promise<AnalyticsReport> {
    const fleetUrl = this.config.get<string>(
      'FLEET_SERVICE_URL',
      'http://localhost:3004',
    );
    const tripsheetUrl = this.config.get<string>(
      'TRIPSHEET_SERVICE_URL',
      'http://localhost:3006',
    );

    const [loads, tripSheets, maintenance, invoices, settlements] =
      await Promise.all([
        this.fetchJson<LoadRecord[]>(`${fleetUrl}/loads`, { companyId }, companyId),
        this.fetchJson<TripSheetRecord[]>(
          `${tripsheetUrl}/trip-sheets`,
          { companyId },
          companyId,
        ),
        this.fetchJson<MaintenanceRecord[]>(
          `${fleetUrl}/maintenance`,
          { companyId },
          companyId,
        ),
        withTenantSchemaRetry(companyId, 'reports.invoices', () =>
          this.prisma.invoice.findMany({ where: { companyId } }),
        ),
        withTenantSchemaRetry(companyId, 'reports.settlements', () =>
          this.prisma.settlement.findMany({ where: { companyId } }),
        ),
      ]);

    const laneMap = new Map<string, { revenue: number; loads: number }>();
    let revenue = 0;
    let cost = 0;
    let milesTotal = 0;
    let delivered = 0;
    let onTime = 0;
    let late = 0;
    const loadProfitability: AnalyticsReport['loadProfitability'] = [];

    for (const load of loads) {
      const lane = `${load.origin || '?'} → ${load.destination || '?'}`;
      const detention =
        Number(load.detentionHours || 0) * Number(load.detentionRate || 0);
      const loadRevenue =
        Number(load.customerRate || 0) +
        Number(load.fuelSurcharge || 0) +
        Number(load.accessorials || 0) +
        detention;
      const loadCost = Number(load.carrierCost || 0);
      revenue += loadRevenue;
      cost += loadCost;
      milesTotal += Number(load.miles || 0);

      const cur = laneMap.get(lane) || { revenue: 0, loads: 0 };
      cur.revenue += loadRevenue;
      cur.loads += 1;
      laneMap.set(lane, cur);

      loadProfitability.push({
        loadId: String(load.id || ''),
        tripNo: String(load.tripNo || ''),
        revenue: loadRevenue,
        cost: loadCost,
        detention,
        margin: loadRevenue - loadCost,
      });

      if (load.status === 'delivered') {
        delivered++;
        if (load.eta && load.actualDelivery) {
          const eta = Date.parse(load.eta);
          const actual = Date.parse(load.actualDelivery);
          if (Number.isFinite(eta) && Number.isFinite(actual)) {
            if (actual <= eta) onTime++;
            else late++;
          }
        }
      }
    }

    let fuelSpend = 0;
    for (const sheet of tripSheets) {
      if (!Array.isArray(sheet.expenses)) continue;
      for (const item of sheet.expenses) {
        const ex = item as ExpenseRecord;
        if (String(ex.category || '').toLowerCase() === 'fuel') {
          fuelSpend += Number(ex.amount || 0) || 0;
        }
      }
    }

    const driverPay = settlements
      .filter((s) => s.status === 'paid' || s.status === 'approved')
      .reduce((s, row) => s + row.totalAmount, 0);

    const today = new Date();
    const aging = {
      current: 0,
      days30: 0,
      days60: 0,
      days90Plus: 0,
      unpaidTotal: 0,
    };
    for (const inv of invoices) {
      if (inv.status === 'paid' || inv.status === 'void') continue;
      const balance = inv.total - inv.amountPaid;
      if (balance <= 0) continue;
      aging.unpaidTotal += balance;
      const due = Date.parse(inv.dueDate);
      const days = Number.isFinite(due)
        ? Math.floor((today.getTime() - due) / 86400000)
        : 0;
      if (days <= 0) aging.current += balance;
      else if (days <= 30) aging.days30 += balance;
      else if (days <= 60) aging.days60 += balance;
      else aging.days90Plus += balance;
    }

    const maintMap = new Map<string, number>();
    for (const row of maintenance) {
      const key = row.unitNo || 'unknown';
      maintMap.set(key, (maintMap.get(key) || 0) + Number(row.cost || 0));
    }

    const grossMargin = revenue - cost;
    return {
      companyId,
      generatedAt: new Date().toISOString(),
      revenueByLane: [...laneMap.entries()].map(([lane, v]) => ({
        lane,
        revenue: v.revenue,
        loads: v.loads,
      })),
      costPerMile: milesTotal > 0 ? cost / milesTotal : 0,
      grossMargin,
      grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
      fuelSpend,
      driverPay,
      invoiceAging: aging,
      maintenanceByTruck: [...maintMap.entries()].map(([unitNo, c]) => ({
        unitNo,
        cost: c,
      })),
      onTimePerformance: {
        delivered,
        onTime,
        late,
        pct: delivered > 0 ? (onTime / delivered) * 100 : 0,
      },
      loadProfitability: loadProfitability.slice(0, 50),
    };
  }

  private sumExpenses(expenses: unknown): number {
    if (!Array.isArray(expenses)) return 0;
    return expenses.reduce((sum, item) => {
      const expense = item as ExpenseRecord;
      const amount = Number(expense.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  private serviceMeshHeaders(companyId: string): Record<string, string> {
    const key =
      this.config.get<string>('INTERNAL_API_KEY') || 'tripsheet-internal-dev';
    const store = getTenantStore();
    const headers: Record<string, string> = {
      'x-internal-api-key': key,
      'x-company-id': companyId,
    };
    if (store?.routingMode) headers['x-tenant-routing'] = store.routingMode;
    if (store?.dbName) headers['x-tenant-db-name'] = store.dbName;
    if (store?.tenantKey) headers['x-tenant-key'] = store.tenantKey;
    if (store?.tenantStatus) headers['x-tenant-status'] = store.tenantStatus;
    return headers;
  }

  private async fetchJson<T>(
    url: string,
    params: Record<string, string>,
    companyId: string,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, {
          params,
          headers: this.serviceMeshHeaders(companyId),
          timeout: 8000,
        }),
      );
      return response.data;
    } catch (e) {
      this.logger.warn(`fetchJson failed url=${url} ${String(e)}`);
      return [] as T;
    }
  }
}
