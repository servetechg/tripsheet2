export type SessionDto = {
  id?: string;
  sessionDays: number;
  accessTokenMinutes?: number;
  idleTimeoutMinutes: number;
  passwordPolicy?: {
    minLength: number;
    complexity: boolean;
    historyCount?: number;
    hint: string;
  };
  mfaRequired: boolean;
  mfaEnabled?: boolean;
  requireMfa: boolean;
  idleNote?: string;
};

export type DeviceSessionDto = {
  id: string;
  deviceLabel: string;
  userAgent: string;
  ip: string;
  trusted: boolean;
  current: boolean;
  active: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revokeReason: string;
};

export type AuthUserDto = {
  id: string;
  email: string;
  pendingEmail?: string | null;
  name: string;
  role: string;
  companyId: string | null;
  status?: string;
  lockedUntil?: string | null;
  suspendedAt?: string | null;
  archivedAt?: string | null;
  tenantKey?: string | null;
  permissions?: string[];
  customRoleId?: string | null;
  customRoleName?: string | null;
  driverId?: string | null;
  driverRecordId?: string | null;
  mfaEnabled?: boolean;
  session?: SessionDto;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
  lifecycleStatus?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
  user: AuthUserDto;
  session?: SessionDto;
  recoveryCodes?: string[];
};

export type LoginResult =
  | AuthTokens
  | {
      mfaRequired: true;
      mfaToken: string;
      message?: string;
    }
  | {
      mfaEnrollmentRequired: true;
      mfaToken: string;
      message?: string;
    };
