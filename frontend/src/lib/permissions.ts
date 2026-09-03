import { useCallback } from 'react';
import {
  canOpenTab,
  hasPermission,
  isCompanyOwnerRole,
  isSuperAdminRole,
} from '@tripsheet/shared';
import { useSession } from '@/context/SessionContext';

export function useCan() {
  const { user } = useSession();
  const perms = user?.permissions ?? [];
  const role = user?.role ?? '';
  const ownerBypass = isCompanyOwnerRole(role) || isSuperAdminRole(role);

  const can = useCallback(
    (code: string) => ownerBypass || hasPermission(perms, code),
    [ownerBypass, perms],
  );

  const canTab = useCallback(
    (tabId: string) => canOpenTab(tabId, perms, { ownerBypass }),
    [perms, ownerBypass],
  );

  return { can, canTab, permissions: perms, role, ownerBypass };
}
