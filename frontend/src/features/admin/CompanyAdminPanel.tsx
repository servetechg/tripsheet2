import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Skeleton } from '@/components/ui';
import { useFakeLoad } from '@/hooks/useFakeLoad';
import { ServiceHealthBanner } from '@/components/feedback/ServiceHealthBanner';
import { AppShell } from '@/components/layout/AppShell';
import { DispatchTab } from '@/features/dispatch/DispatchTab';
import { TrackTab } from '@/features/tracking/TrackTab';
import { EManifestTab } from '@/features/manifests/EManifestTab';
import { DriversTab } from '@/features/drivers/DriversTab';
import { AssetsTab } from '@/features/assets/AssetsTab';
import { AdminSheetsTab } from '@/features/trip-sheets/AdminSheetsTab';
import { PrintPreview } from '@/features/trip-sheets/PrintPreview';
import { ReportsTab } from '@/features/reports/ReportsTab';
import { AccountingTab } from '@/features/accounting/AccountingTab';
import { DashboardTab } from '@/features/dashboard/DashboardTab';
import { FleetOpsTab } from '@/features/fleet/FleetOpsTab';
import { MessagesTab } from '@/features/comms/MessagesTab';
import { ComplianceTab } from '@/features/compliance/ComplianceTab';
import { CompanySettingsTab } from '@/features/companies/CompanySettingsTab';
import { companiesApi } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { ROLE_LABELS } from '@tripsheet/shared';
import type { Role } from '@tripsheet/shared';

export function CompanyAdminPanel({
  company,
  adminUser,
  users,
  setUsers,
  sheets,
  loads,
  setLoads,
  assets,
  setAssets,
  manifests,
  setManifests,
  carrierProfiles,
  setCarrierProfiles,
  driverDocs,
  setDriverDocs,
  invites,
  setInvites,
  onLogout,
  themeMode,
  onToggleTheme,
  apiEnabled,
  refreshAll,
  activeTab,
  onTabChange,
}: any) {
  const { canTab, can, role } = useCan();
  const tab = activeTab || 'dashboard';
  const setTab = onTabChange || (() => {});
  const [adminPreview, setAdminPreview] = useState<any>(null);
  const [entitlements, setEntitlements] = useState<any>(null);
  const sn = company.shortName;

  const myDrivers = users.filter(
    (u: any) => u.role === 'driver' && u.companyId === company.id,
  );
  const myLoads = loads.filter((l: any) => l.companyId === company.id);
  const mySheets = sheets.filter((s: any) => s.companyId === company.id);
  const myTrucks = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'truck',
  );
  const myTrailers = assets.filter(
    (a: any) => a.companyId === company.id && a.type === 'trailer',
  );
  const myManifests = manifests.filter((m: any) => m.companyId === company.id);
  const myCarrier = carrierProfiles.find(
    (p: any) => p.companyId === company.id,
  ) || {
    companyId: company.id,
    cbsaCarrierCode: '',
    scacCode: '',
    dotNumber: '',
    fastLane: false,
  };

  const TABS = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'dispatch', icon: 'dispatch', label: 'Dispatch' },
    { id: 'track', icon: 'track', label: 'Track' },
    { id: 'emanifest', icon: 'emanifest', label: 'eManifest' },
    { id: 'drivers', icon: 'drivers', label: 'Drivers' },
    { id: 'assets', icon: 'assets', label: 'Assets' },
    { id: 'fleet', icon: 'status', label: 'Fleet Ops' },
    { id: 'sheets', icon: 'sheets', label: 'Sheets' },
    { id: 'messages', icon: 'bell', label: 'Messages' },
    { id: 'compliance', icon: 'docs', label: 'Compliance' },
    { id: 'reports', icon: 'reports', label: 'Reports' },
    ...(entitlements?.features?.accounting !== false
      ? [{ id: 'accounting', icon: 'accounting', label: 'Accounting' }]
      : []),
    { id: 'users', icon: 'companies', label: 'Users' },
    { id: 'company', icon: 'companies', label: 'Company' },
  ].filter((t) => {
    if (t.id === 'accounting' && !can('accounting.view')) return false;
    return canTab(t.id);
  });

  useEffect(() => {
    if (!apiEnabled || !company?.id) return;
    void companiesApi
      .entitlements(company.id)
      .then(setEntitlements)
      .catch(() => setEntitlements(null));
  }, [apiEnabled, company?.id]);

  const STATUS_COLOR = {
    assigned: G.info,
    in_transit: G.gold,
    delivered: G.success,
    cancelled: G.danger,
  };

  const tabLoading = useFakeLoad(tab, 380);

  if (adminPreview) {
    return (
      <PrintPreview
        company={company}
        header={adminPreview.header}
        trips={adminPreview.trips}
        expenses={adminPreview.expenses}
        notes={adminPreview.notes}
        onBack={() => setAdminPreview(null)}
      />
    );
  }

  const apiProps = { apiEnabled, refreshAll };

  return (
    <AppShell
      logo={sn}
      subtitle={
        ROLE_LABELS[role as Role] || 'Staff'
      }
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      userName={adminUser?.name}
      userEmail={adminUser?.email}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
      onLogout={onLogout}
    >
      <ServiceHealthBanner />
      {tabLoading ? (
        <Skeleton rows={4} />
      ) : (
        <>
          {tab === 'dashboard' && (
            <DashboardTab
              company={company}
              loads={myLoads}
              sheets={mySheets}
              drivers={myDrivers}
              trucks={myTrucks}
              users={users}
              onNavigate={setTab}
            />
          )}
          {tab === 'dispatch' && (
            <DispatchTab
              company={company}
              loads={myLoads}
              setLoads={setLoads}
              drivers={myDrivers}
              trucks={myTrucks}
              trailers={myTrailers}
              users={users}
              statusColor={STATUS_COLOR}
              onTrack={() => setTab('track')}
              onEManifest={() => setTab('emanifest')}
              driverDocs={driverDocs}
              {...apiProps}
            />
          )}
          {tab === 'track' && (
            <TrackTab
              company={company}
              loads={myLoads}
              setLoads={setLoads}
              users={users}
              statusColor={STATUS_COLOR}
              {...apiProps}
            />
          )}
          {tab === 'emanifest' && (
            <EManifestTab
              company={company}
              manifests={myManifests}
              setManifests={setManifests}
              carrier={myCarrier}
              carrierProfiles={carrierProfiles}
              setCarrierProfiles={setCarrierProfiles}
              drivers={myDrivers}
              trucks={myTrucks}
              trailers={myTrailers}
              loads={myLoads}
              {...apiProps}
            />
          )}
          {tab === 'drivers' && (
            <DriversTab
              company={company}
              drivers={myDrivers}
              setUsers={setUsers}
              users={users}
              loads={myLoads}
              sheets={mySheets}
              driverDocs={driverDocs}
              setDriverDocs={setDriverDocs}
              invites={invites}
              setInvites={setInvites}
              {...apiProps}
            />
          )}
          {tab === 'assets' && (
            <AssetsTab
              company={company}
              assets={assets}
              setAssets={setAssets}
              loads={myLoads}
              {...apiProps}
            />
          )}
          {tab === 'fleet' && (
            <FleetOpsTab
              company={company}
              assets={assets.filter((a: any) => a.companyId === company.id)}
              drivers={myDrivers}
              adminUser={adminUser}
              apiEnabled={apiEnabled}
            />
          )}
          {tab === 'sheets' && (
            <AdminSheetsTab
              sheets={mySheets}
              users={users}
              company={company}
              onViewPdf={setAdminPreview}
            />
          )}
          {tab === 'messages' && (
            <MessagesTab
              company={company}
              drivers={myDrivers}
              loads={myLoads}
              adminUser={adminUser}
              apiEnabled={apiEnabled}
            />
          )}
          {tab === 'compliance' && (
            <ComplianceTab
              company={company}
              drivers={myDrivers}
              driverDocs={driverDocs}
              assets={assets.filter((a: any) => a.companyId === company.id)}
              adminUser={adminUser}
              apiEnabled={apiEnabled}
              onGoDrivers={() => setTab('drivers')}
            />
          )}
          {tab === 'reports' && (
            <ReportsTab company={company} apiEnabled={apiEnabled} />
          )}
          {tab === 'accounting' && entitlements?.features?.accounting !== false && (
            <AccountingTab
              company={company}
              drivers={myDrivers}
              sheets={mySheets}
              loads={myLoads}
              adminUser={adminUser}
              apiEnabled={apiEnabled}
            />
          )}
          {tab === 'users' && (
            <CompanySettingsTab
              company={company}
              adminUser={adminUser}
              apiEnabled={apiEnabled}
              refreshAll={refreshAll}
              initialSub="users"
            />
          )}
          {tab === 'company' && (
            <CompanySettingsTab
              company={company}
              adminUser={adminUser}
              apiEnabled={apiEnabled}
              refreshAll={refreshAll}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
