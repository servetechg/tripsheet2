import { AppDataProvider } from '@/context/AppDataContext';
import { AppRoutes } from '@/routes/AppRoutes';

/** Shell only — providers + session routing. */
export default function App() {
  return (
    <AppDataProvider>
      <AppRoutes />
    </AppDataProvider>
  );
}
