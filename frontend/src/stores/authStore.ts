import { useState } from 'react';
import type { SeedUser } from '@/data/seed';

export type SessionUser = SeedUser;

export function useSession() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const logout = () => setSession(null);
  return { session, setSession, logout };
}
