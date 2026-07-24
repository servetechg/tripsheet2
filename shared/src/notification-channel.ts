export const NOTIFICATION_CHANNELS = ['sms'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = [
  'queued',
  'sent',
  'failed',
  'simulated',
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
