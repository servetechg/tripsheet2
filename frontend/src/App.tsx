import { BrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '@/context/AppDataContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { SessionProvider } from '@/context/SessionContext';
import { AppRoutes } from '@/routes/AppRoutes';
import { PushNotificationProvider } from '@/components/push/PushNotificationProvider';
import { InAppNotificationProvider } from '@/components/notifications/InAppNotificationProvider';

/** Shell — providers + router. */
export default function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <AppDataProvider>
          <SessionProvider>
            <InAppNotificationProvider>
              <PushNotificationProvider>
                <AppRoutes />
              </PushNotificationProvider>
            </InAppNotificationProvider>
          </SessionProvider>
        </AppDataProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
}
