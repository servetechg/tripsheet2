export const INVITE_STATUSES = ['pending', 'completed', 'expired'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];
