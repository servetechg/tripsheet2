import { useEffect, useState } from 'react';
import { notificationsApi } from '@/lib/api';

export function useSmsEnabled(apiEnabled: boolean) {
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiEnabled) {
      setSmsEnabled(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    notificationsApi
      .deliveryStatus()
      .then((d) => {
        if (!cancelled) setSmsEnabled(Boolean(d.smsEnabled));
      })
      .catch(() => {
        if (!cancelled) setSmsEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiEnabled]);

  return { smsEnabled, loading };
}

export const SMS_DISABLED_HINT =
  'SMS is disabled until Twilio credentials are set in backend/.env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER). Restart notification-service after adding them.';
