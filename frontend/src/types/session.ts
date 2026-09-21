import type { Role } from '@tripsheet/shared';
import type {
  DriverAvailabilityStatus,
  DriverLifecycleStatus,
  DriverType,
  EmploymentStatus,
  QualificationType,
} from '@tripsheet/shared';
import type { AuthUserDto } from '@/types/auth';

/** Driver qualification row from driver-service (Chapter 6). */
export type DriverQualificationRow = {
  id: string;
  driverId: string;
  type: QualificationType | string;
  status?: string;
  expiryDate?: string | null;
  documentId?: string | null;
  notes?: string;
  number?: string;
};

/** Signed-in user merged with driver record / HR fields in the UI. */
export type AppUser = AuthUserDto & {
  /** JWT subject (auth-service); falls back to `id` in UI. */
  sub?: string;
  role: Role | string;
  password?: string;
  driverRecordId?: string | null;
  phone?: string;
  dob?: string;
  licenseNo?: string;
  citizenship?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  fastCard?: string;
  notes?: string;
  sin?: string;
  active?: boolean;
  lifecycleStatus?: DriverLifecycleStatus | string;
  driverType?: DriverType | string;
  employeeNumber?: string;
  employmentStatus?: EmploymentStatus | string;
  hireDate?: string;
  probationEndDate?: string;
  seniorityDate?: string;
  branchId?: string;
  managerUserId?: string;
  dispatcherUserId?: string;
  preferredName?: string;
  preferredLanguage?: string;
  ownerOperatorProfile?: Record<string, unknown>;
  qualifications?: DriverQualificationRow[];
  availabilityStatus?: DriverAvailabilityStatus | string;
};
