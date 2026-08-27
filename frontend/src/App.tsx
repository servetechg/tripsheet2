import { BrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '@/context/AppDataContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { SessionProvider } from '@/context/SessionContext';
import { AppRoutes } from '@/routes/AppRoutes';

/** Shell — providers + router. */
export default function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <AppDataProvider>
          <SessionProvider>
            <AppRoutes />
          </SessionProvider>
        </AppDataProvider>
      </ConfirmProvider>
    </BrowserRouter>
  );
}
