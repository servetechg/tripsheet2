import type { ContractForm, FileUploadData } from '@/types/app';
import type { InviteDetailDto, PlatformCompany } from '@/types/dtos';

export type OnboardingProfile = {
  name: string;
  email: string;
  password: string;
  phone: string;
  dob: string;
  licenseNo: string;
  citizenship: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  fastCard: string;
  notes: string;
};

export type OnboardingDocument = {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData: string;
  uploadedAt: string;
  expiryDate: string;
  notes: string;
  status: string;
};

export type DriverOnboardingProps = {
  invite: InviteDetailDto;
  company: PlatformCompany | { id: string; name: string };
  onComplete: (
    profile: OnboardingProfile,
    docs: OnboardingDocument[],
    contract: ContractForm,
  ) => Promise<void>;
};
