import type { Asset, CarrierProfile, Load } from '@tripsheet/shared';
import type { Manifest } from '@/types/app';
import type { PlatformCompany } from '@/types/dtos';
import type { AppUser } from '@/types/session';
import type { EManifestTabProps } from '@/types/tabs';
import type { Setter } from '@/types/app';

export type EManifestFormProps = {
  type: 'ACI' | 'ACE';
  company: PlatformCompany;
  carrier: CarrierProfile;
  drivers: AppUser[];
  trucks: Asset[];
  trailers: Asset[];
  loads: Load[];
  genCRN: (carrierCode: string) => string;
  genCCN: (carrierCode: string) => string;
  editData?: Manifest | null;
  onSave: (manifest: Manifest) => void | Promise<void>;
  onBack: () => void;
  apiEnabled: boolean;
};

export type EManifestCardProps = {
  manifest: Manifest;
  drivers: AppUser[];
  trucks: Asset[];
  trailers: Asset[];
  pending?: string | boolean;
  error?: string | null;
  onDismissError?: () => void;
  onSubmit: () => void | Promise<void>;
  onAccept: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onEdit: () => void;
  onLeadSheet: () => void;
};

export type LeadSheetProps = {
  manifest: Manifest;
  company: PlatformCompany;
  carrier: CarrierProfile;
  onBack: () => void;
};

export type CarrierProfileFormProps = {
  carrier: CarrierProfile;
  onSave: (profile: CarrierProfile) => void | Promise<void>;
  onClose: () => void;
};

export type { EManifestTabProps, Manifest, Setter };
