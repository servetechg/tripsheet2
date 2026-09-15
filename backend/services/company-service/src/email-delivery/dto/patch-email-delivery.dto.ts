export type PatchEmailDeliveryDto = {
  mode?: 'platform' | 'smtp';
  fromDisplayName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  /** Set to rotate password; omit to keep existing. */
  smtpPass?: string;
  active?: boolean;
};
