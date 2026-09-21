import type { Expense, TripLeg, TripSheet } from '@tripsheet/shared';
import type { PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';
import type { CompanyBrandingDto } from '@/types/dtos';

export type AdminSheetsTabProps = {
  sheets: TripSheet[];
  users: AppUser[];
  company: PlatformCompany;
  onViewPdf?: (sheet: TripSheet) => void;
};

export type PrintPreviewProps = {
  company: PlatformCompany;
  header: TripSheet['header'];
  trips: TripLeg[];
  expenses: Expense[];
  notes: string;
  onBack: () => void;
  branding?: CompanyBrandingDto;
};

export type TripSheetFormProps = {
  company: PlatformCompany;
  user: AppUser;
  editSheet?: TripSheet | null;
  onSave: (sheet: TripSheet) => void | Promise<void>;
  onBack: () => void;
};
