import { BrowserRouter } from 'react-router-dom';
import { AppDataProvider } from '@/context/AppDataContext';
import { SessionProvider } from '@/context/SessionContext';
import { AppRoutes } from '@/routes/AppRoutes';

/** Shell — providers + router. */
export default function App() {
  return (
    <BrowserRouter>
      <AppDataProvider>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </AppDataProvider>
    </BrowserRouter>
  );
}
