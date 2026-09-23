import { useCallback, useEffect, useRef, useState } from 'react';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
} from 'firebase/messaging';
import { notify } from '@/components/feedback/Toast';
import {
  isFirebaseWebPushConfigured,
  readFirebaseVapidKey,
  readFirebaseWebConfig,
} from '@/lib/firebase';
import { requestInAppInboxRefresh } from '@/lib/inAppInboxEvents';
import { pushApi } from '@/lib/api';

function showForegroundPush(title: string, body: string): void {
  if (
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(title, { body, icon: '/favicon.ico' });
      return;
    } catch {
      /* fall through to toast */
    }
  }
  notify(body ? `${title}: ${body}` : title, 'info');
}

const PUSH_OFFER_KEY = 'ts_push_permission_offered';

let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  if (!isFirebaseWebPushConfigured()) return null;
  if (!firebaseApp) {
    const cfg = readFirebaseWebConfig();
    if (!cfg) return null;
    firebaseApp = initializeApp(cfg);
  }
  if (!messagingInstance) {
    messagingInstance = getMessaging(firebaseApp);
  }
  return messagingInstance;
}

export function useWebPush(enabled: boolean) {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const configured = isFirebaseWebPushConfigured();

  const syncToken = useCallback(async (): Promise<string | null> => {
    if (!enabled || !configured) return null;
    if (Notification.permission !== 'granted') return null;

    const messaging = getFirebaseMessaging();
    const vapidKey = readFirebaseVapidKey();
    if (!messaging || !vapidKey) return null;

    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' },
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    if (tokenRef.current !== token) {
      try {
        await pushApi.register({ token, platform: 'web' });
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : 'Could not save push token on server';
        notify(msg, 'error');
        throw e;
      }
      tokenRef.current = token;
    }
    setRegistered(true);
    return token;
  }, [enabled, configured]);

  const enablePush = useCallback(async () => {
    if (!configured) {
      notify(
        'Web push is not configured. Set VITE_FIREBASE_* in frontend/.env.',
        'error',
      );
      return false;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        notify('Browser notifications were not allowed.', 'error');
        return false;
      }
      await syncToken();
      notify('Browser notifications enabled.', 'success');
      return true;
    } catch (e) {
      notify(
        e instanceof Error ? e.message : 'Could not enable notifications',
        'error',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [configured, syncToken]);

  const sendTest = useCallback(async () => {
    try {
      const res = await pushApi.test();
      if (res.sent > 0) {
        notify('Test notification sent.', 'success');
        return;
      }
      notify(
        res.hint ||
          `Push test failed (${res.reason ?? 'unknown'}). sent=${res.sent} failed=${res.failed}`,
        'error',
      );
    } catch (e) {
      notify(
        e instanceof Error ? e.message : 'Test notification failed',
        'error',
      );
    }
  }, []);

  const disablePush = useCallback(async () => {
    setBusy(true);
    try {
      if (tokenRef.current) {
        await pushApi.unregister({ token: tokenRef.current });
      } else {
        await pushApi.unregister({});
      }
      tokenRef.current = null;
      setRegistered(false);
      notify('Browser notifications disabled for this device.', 'success');
    } catch (e) {
      notify(
        e instanceof Error ? e.message : 'Could not disable notifications',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) return;
    const token = tokenRef.current;
    if (!token) return;
    tokenRef.current = null;
    setRegistered(false);
    void pushApi.unregister({ token }).catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !configured) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    try {
      if (sessionStorage.getItem(PUSH_OFFER_KEY) === '1') return;
      sessionStorage.setItem(PUSH_OFFER_KEY, '1');
    } catch {
      return;
    }
    const id = window.setTimeout(() => {
      void enablePush();
    }, 1500);
    return () => window.clearTimeout(id);
  }, [enabled, configured, enablePush]);

  useEffect(() => {
    if (!enabled || !configured) return;
    void syncToken().catch(() => undefined);
  }, [enabled, configured, syncToken]);

  useEffect(() => {
    if (!enabled || !configured) return;
    const messaging = getFirebaseMessaging();
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'FleetQuix';
      const body = payload.notification?.body || '';
      showForegroundPush(title, body);
      requestInAppInboxRefresh();
    });
    return () => unsub();
  }, [enabled, configured]);

  return {
    configured,
    permission,
    registered,
    busy,
    enablePush,
    disablePush,
    syncToken,
    sendTest,
  };
}
