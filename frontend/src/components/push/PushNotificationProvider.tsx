import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { useSession } from '@/context/SessionContext';
import { useWebPush } from '@/hooks/useWebPush';

type PushNotificationContextValue = ReturnType<typeof useWebPush>;

const PushNotificationContext =
  createContext<PushNotificationContextValue | null>(null);

/** Firebase Cloud Messaging (browser/OS push). Not the header in-app notification inbox. */
export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useSession();
  const value = useWebPush(Boolean(user) && !bootstrapping);
  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications(): PushNotificationContextValue {
  const ctx = useContext(PushNotificationContext);
  if (!ctx) {
    throw new Error(
      'usePushNotifications must be used within PushNotificationProvider',
    );
  }
  return ctx;
}
