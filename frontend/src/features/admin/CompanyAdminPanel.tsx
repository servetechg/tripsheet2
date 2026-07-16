import { useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Skeleton } from '@/components/ui';
import { useFakeLoad } from '@/hooks/useFakeLoad';
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
  const tab = activeTab || 'dispatch';
  const setTab = onTabChange || (() => {});
  const [adminPreview, setAdminPreview] = useState<any>(null);
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
    { id: 'dispatch', icon: '🚚', label: 'Dispatch' },
    { id: 'track', icon: '📍', label: 'Track' },
    { id: 'emanifest', icon: '🛃', label: 'eManifest' },
    { id: 'drivers', icon: '👤', label: 'Drivers' },
    { id: 'assets', icon: '🔧', label: 'Assets' },
    { id: 'sheets', icon: '📋', label: 'Sheets' },
    { id: 'reports', icon: '📊', label: 'Reports' },
    { id: 'accounting', icon: '💰', label: 'Accounting' },
  ];

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
      subtitle="Admin"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
      topRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Btn
            variant="outline"
            onClick={onLogout}
            style={{ fontSize: 11, padding: '8px 14px' }}
          >
            LOGOUT
          </Btn>
        </div>
      }
    >
      {tabLoading ? (
        <Skeleton rows={4} />
      ) : (
        <>
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
          {tab === 'sheets' && (
            <AdminSheetsTab
              sheets={mySheets}
              users={users}
              company={company}
              onViewPdf={setAdminPreview}
            />
          )}
          {tab === 'reports' && (
            <ReportsTab company={company} apiEnabled={apiEnabled} />
          )}
          {tab === 'accounting' && (
            <AccountingTab
              company={company}
              drivers={myDrivers}
              sheets={mySheets}
              apiEnabled={apiEnabled}
            />
          )}
        </>
      )}
    </AppShell>
  );
}
