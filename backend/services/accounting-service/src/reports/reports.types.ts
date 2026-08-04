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

export interface AnalyticsReport {
  companyId: string;
  generatedAt: string;
  revenueByLane: { lane: string; revenue: number; loads: number }[];
  costPerMile: number;
  grossMargin: number;
  grossMarginPct: number;
  fuelSpend: number;
  driverPay: number;
  invoiceAging: {
    current: number;
    days30: number;
    days60: number;
    days90Plus: number;
    unpaidTotal: number;
  };
  maintenanceByTruck: { unitNo: string; cost: number }[];
  onTimePerformance: {
    delivered: number;
    onTime: number;
    late: number;
    pct: number;
  };
  loadProfitability: {
    loadId: string;
    tripNo: string;
    revenue: number;
    cost: number;
    detention: number;
    margin: number;
  }[];
}

export interface LoadRecord {
  id?: string;
  driverId?: string | null;
  status?: string;
  origin?: string;
  destination?: string;
  tripNo?: string;
  customerRate?: number;
  carrierCost?: number;
  fuelSurcharge?: number;
  accessorials?: number;
  detentionHours?: number;
  detentionRate?: number;
  miles?: number;
  eta?: string | null;
  actualDelivery?: string | null;
  truckNo?: string | null;
}

export interface AssetRecord {
  id?: string;
  type?: string;
  status?: string;
  unitNo?: string;
  insuranceExpiry?: string | null;
  plateExpiry?: string | null;
  permitExpiry?: string | null;
}

export interface TripSheetRecord {
  expenses?: unknown;
}

export interface ExpenseRecord {
  amount?: number | string;
  category?: string;
}

export interface MaintenanceRecord {
  unitNo?: string;
  cost?: number;
  type?: string;
}
