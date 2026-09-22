export const PUSH_PLATFORMS = ['web'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export interface PushRegisterRequest {
  token: string;
  platform?: PushPlatform;
}

export interface PushUnregisterRequest {
  token?: string;
}

export interface PushStatusResponse {
  firebaseConfigured: boolean;
  registered: boolean;
  tokenCount: number;
}

export type PushTestReason =
  | 'delivered'
  | 'firebase_not_configured'
  | 'no_device_tokens'
  | 'fcm_send_failed';

export interface PushTestResponse {
  sent: number;
  failed: number;
  reason: PushTestReason;
  hint?: string;
}

/** FCM data payload values must be strings. */
export interface PushSendRequest {
  companyId: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
