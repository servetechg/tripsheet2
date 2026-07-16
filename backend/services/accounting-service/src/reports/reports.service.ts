import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssetRecord,
  CompanyReportSummary,
  ExpenseRecord,
  LoadRecord,
  TripSheetRecord,
} from './reports.types';

@Injectable()
export class ReportsService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getSummary(companyId: string): Promise<CompanyReportSummary> {
    const fleetUrl = this.config.get<string>(
      'FLEET_SERVICE_URL',
      'http://localhost:3004',
    );
    const tripsheetUrl = this.config.get<string>(
      'TRIPSHEET_SERVICE_URL',
      'http://localhost:3006',
    );

    const [loads, assets, tripSheets, settlements] = await Promise.all([
      this.fetchJson<LoadRecord[]>(`${fleetUrl}/loads`, { companyId }),
      this.fetchJson<AssetRecord[]>(`${fleetUrl}/assets`, { companyId }),
      this.fetchJson<TripSheetRecord[]>(
        `${tripsheetUrl}/trip-sheets`,
        { companyId },
      ),
      this.prisma.settlement.findMany({ where: { companyId } }),
    ]);

    const driverIds = new Set<string>();
    for (const load of loads) {
      if (load.driverId) {
        driverIds.add(load.driverId);
      }
    }
    for (const settlement of settlements) {
      if (settlement.driverId) {
        driverIds.add(settlement.driverId);
      }
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
      if (asset.type === 'truck') {
        trucks++;
      } else if (asset.type === 'trailer') {
        trailers++;
      }
      if (asset.status === 'active') {
        activeAssets++;
      }
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

  private sumExpenses(expenses: unknown): number {
    if (!Array.isArray(expenses)) {
      return 0;
    }

    return expenses.reduce((sum, item) => {
      const expense = item as ExpenseRecord;
      const amount = Number(expense.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  private async fetchJson<T>(
    url: string,
    params: Record<string, string>,
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(url, { params, timeout: 8000 }),
      );
      return response.data;
    } catch {
      return [] as T;
    }
  }
}
