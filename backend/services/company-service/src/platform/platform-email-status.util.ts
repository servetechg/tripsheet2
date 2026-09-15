import { resolvePlatformFromEmail } from './platform-from.util';

export function getPlatformEmailStatus(env: NodeJS.ProcessEnv = process.env) {
  const smtpConfigured = Boolean(
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS,
  );
  const fromAddress = resolvePlatformFromEmail(env);

  return {
    provider: smtpConfigured && fromAddress ? ('smtp' as const) : ('none' as const),
    smtpConfigured,
    platformReady: Boolean(smtpConfigured && fromAddress),
    platformFromAddress: fromAddress,
  };
}
