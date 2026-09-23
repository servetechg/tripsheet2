import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  InAppNotification,
  InAppNotificationEvent,
} from '@tripsheet/shared';
import {
  IN_APP_SOCKET_EVENT,
  IN_APP_SOCKET_NAMESPACE,
} from '@tripsheet/shared';
import { apiOrigin, getToken, inAppNotificationsApi } from '@/lib/api';
import { isAccessTokenValidForSocket } from '@/lib/accessToken';
import { IN_APP_INBOX_REFRESH_EVENT } from '@/lib/inAppInboxEvents';
import { useSession } from '@/context/SessionContext';

type InAppNotificationContextValue = {
  items: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
};

const InAppNotificationContext =
  createContext<InAppNotificationContextValue | null>(null);

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useSession();
  const enabled = Boolean(user) && !bootstrapping;
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const applyList = useCallback(
    (nextItems: InAppNotification[], nextUnread: number) => {
      setItems(nextItems);
      const visibleUnread = nextItems.filter((n) => !n.readAt).length;
      setUnreadCount(Math.max(nextUnread, visibleUnread));
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await inAppNotificationsApi.list();
      applyList(res.items, res.unreadCount);
    } catch {
      /* inbox optional when offline */
    } finally {
      setLoading(false);
    }
  }, [enabled, applyList]);

  const markRead = useCallback(async (id: string) => {
    try {
      const updated = await inAppNotificationsApi.markRead(id);
      setItems((list) => {
        const prev = list.find((n) => n.id === id);
        if (prev && !prev.readAt && updated.readAt) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return list.map((n) => (n.id === id ? updated : n));
      });
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => ({
        ...n,
        readAt: n.readAt ?? now,
      })),
    );
    setUnreadCount(0);
    try {
      await inAppNotificationsApi.markAllRead();
    } catch {
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [enabled, refresh, user?.id, user?.companyId]);

  useEffect(() => {
    if (!enabled) return;
    const onPushRefresh = () => {
      void refresh();
    };
    window.addEventListener(IN_APP_INBOX_REFRESH_EVENT, onPushRefresh);
    return () =>
      window.removeEventListener(IN_APP_INBOX_REFRESH_EVENT, onPushRefresh);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!isAccessTokenValidForSocket()) {
      return;
    }

    const token = getToken();
    if (!token) return;

    const socket = io(`${apiOrigin()}${IN_APP_SOCKET_NAMESPACE}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    const onNotification = (payload: InAppNotificationEvent) => {
      const n = payload.notification;
      setItems((prev) => {
        const without = prev.filter((x) => x.id !== n.id);
        return [n, ...without].slice(0, 50);
      });
      setUnreadCount(payload.unreadCount);
    };

    const onConnectError = () => {
      void refresh();
    };

    socket.on(IN_APP_SOCKET_EVENT, onNotification);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off(IN_APP_SOCKET_EVENT, onNotification);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [enabled, user?.id, user?.companyId, refresh]);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      markRead,
      markAllRead,
      refresh,
    }),
    [items, unreadCount, loading, markRead, markAllRead, refresh],
  );

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotifications(): InAppNotificationContextValue {
  const ctx = useContext(InAppNotificationContext);
  if (!ctx) {
    throw new Error(
      'useInAppNotifications must be used within InAppNotificationProvider',
    );
  }
  return ctx;
}
