export interface CompanyReportSummary {
  companyId: string;
  generatedAt: string;
  loads: {
    total: number;
    assigned: number;
    inTransit: number;
    delivered: number;
    cancelled: number;
  };
  fleet: {
    trucks: number;
    trailers: number;
    activeAssets: number;
  };
  drivers: number;
  tripSheets: number;
  expenseTotal: number;
  settlements: {
    draft: number;
    approved: number;
    paid: number;
    paidAmount: number;
  };
}

export interface LoadRecord {
  driverId?: string | null;
  status?: string;
}

export interface AssetRecord {
  type?: string;
  status?: string;
}

export interface TripSheetRecord {
  expenses?: unknown;
}

export interface ExpenseRecord {
  amount?: number | string;
}
