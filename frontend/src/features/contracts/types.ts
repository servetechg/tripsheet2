import type { EmploymentContractDto } from '@/types/dtos';
import type { PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';
import type { ContractForm } from '@/types/app';

export type EmploymentContractModalProps = {
  driver: AppUser;
  company: PlatformCompany;
  existingContract?: EmploymentContractDto | null;
  onSave: (contract: ContractForm) => void | Promise<void>;
  onClose: () => void;
};

export type AdminWageModalProps = EmploymentContractModalProps;
