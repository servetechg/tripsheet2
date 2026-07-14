import { useState } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Icons, StatsGrid, Btn } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { manifestsApi, carrierProfilesApi } from '@/lib/api';
import { CarrierProfileForm } from './CarrierProfileForm';
import { EManifestForm } from './EManifestForm';
import { EManifestCard } from './EManifestCard';
import { LeadSheet } from './LeadSheet';

export function EManifestTab({
  company,
  manifests,
  setManifests,
  carrier,
  carrierProfiles,
  setCarrierProfiles,
  drivers,
  trucks,
  trailers,
  loads,
  apiEnabled,
  refreshAll,
}: any) {
  const [subTab, setSubTab] = useState('list');
  const [editingManifest, setEditingManifest] = useState<any>(null);
  const [viewLeadSheet, setViewLeadSheet] = useState<any>(null);

  const [pending, setPending] = useState<any>({});
  const [actionError, setActionError] = useState<any>(null);

  const runGatewayAction = (
    id: string,
    label: string,
    apply: () => void | Promise<void>,
    {
      failRate = 0,
      successMsg,
    }: { failRate?: number; successMsg?: string } = {},
  ) => {
    setActionError(null);
    setPending((p: any) => ({ ...p, [id]: label }));

    const finish = async () => {
      try {
        if (apiEnabled) {
          await apply();
          await refreshAll?.();
          if (successMsg) notify(successMsg);
        } else {
          await new Promise((r) =>
            setTimeout(r, 700 + Math.random() * 600),
          );
          if (Math.random() < failRate) {
            const msg = `${label} failed — border gateway did not respond. Please try again.`;
            setActionError({ id, msg });
            notify(msg, 'error');
            return;
          }
          await apply();
          if (successMsg) notify(successMsg);
        }
      } catch (e: any) {
        const msg = e?.message || `${label} failed. Please try again.`;
        setActionError({ id, msg });
        notify(msg, 'error');
      } finally {
        setPending((p: any) => {
          const n = { ...p };
          delete n[id];
          return n;
        });
      }
    };

    void finish();
  };

  const genCRN = (carrierCode: string) => {
    const suffix = Date.now().toString(36).toUpperCase().slice(-5);
    return (carrierCode || 'XXXX') + suffix;
  };

  const genCCN = (carrierCode: string) => {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return (carrierCode || 'XXXX') + suffix;
  };

  const toApiBody = (m: any) => ({
    companyId: company.id,
    type: m.type,
    crn: m.crn,
    loadId: m.tripLoadId || m.loadId || undefined,
    driverId: m.driverId || undefined,
    truckId: m.truckId || undefined,
    trailerId: m.trailerId || undefined,
    portOfEntry: m.portCode || m.portOfEntry || undefined,
    estimatedArrival: m.eta
      ? `${m.eta}${m.etaTime ? ' ' + m.etaTime : ''}`
      : undefined,
    shipments: m.shipments,
    formData: {
      portCode: m.portCode,
      eta: m.eta,
      etaTime: m.etaTime,
      sealNo: m.sealNo,
      coDriverId: m.coDriverId,
      driverDOB: m.driverDOB,
      driverCitizenship: m.driverCitizenship,
      driverPassport: m.driverPassport,
      driverFAST: m.driverFAST,
      notes: m.notes,
      tripLoadId: m.tripLoadId,
      truckNo: m.truckNo,
      trailerNo: m.trailerNo,
      driverName: m.driverName,
      portName: m.portName,
      status: m.status,
    },
  });

  const saveManifest = async (m: any) => {
    try {
      if (apiEnabled) {
        const existing = manifests.find((x: any) => x.id === m.id);
        if (existing) {
          await manifestsApi.update(m.id, toApiBody(m));
        } else {
          await manifestsApi.create(toApiBody(m));
        }
        await refreshAll?.();
      } else {
        setManifests((p: any[]) => {
          const ex = p.find((x) => x.id === m.id);
          return ex ? p.map((x) => (x.id === m.id ? m : x)) : [...p, m];
        });
      }
      setEditingManifest(null);
      setSubTab('list');
    } catch (e: any) {
      notify(e?.message || 'Failed to save eManifest', 'error');
    }
  };

  if (viewLeadSheet)
    return (
      <LeadSheet
        manifest={viewLeadSheet}
        company={company}
        carrier={carrier}
        onBack={() => setViewLeadSheet(null)}
      />
    );
  if (subTab === 'new_aci')
    return (
      <EManifestForm
        type="ACI"
        company={company}
        carrier={carrier}
        drivers={drivers}
        trucks={trucks}
        trailers={trailers}
        loads={loads}
        genCRN={genCRN}
        genCCN={genCCN}
        editData={editingManifest}
        onSave={saveManifest}
        onBack={() => {
          setEditingManifest(null);
          setSubTab('list');
        }}
      />
    );
  if (subTab === 'new_ace')
    return (
      <EManifestForm
        type="ACE"
        company={company}
        carrier={carrier}
        drivers={drivers}
        trucks={trucks}
        trailers={trailers}
        loads={loads}
        genCRN={genCRN}
        genCCN={genCCN}
        editData={editingManifest}
        onSave={saveManifest}
        onBack={() => {
          setEditingManifest(null);
          setSubTab('list');
        }}
      />
    );

  const aciCount = manifests.filter((m: any) => m.type === 'ACI').length;
  const aceCount = manifests.filter((m: any) => m.type === 'ACE').length;
  const acceptedCount = manifests.filter(
    (m: any) => m.status === 'accepted',
  ).length;
  const pendingCount = manifests.filter(
    (m: any) => m.status === 'submitted',
  ).length;

  const submitManifest = (id: string) =>
    runGatewayAction(
      id,
      'Submission',
      async () => {
        if (apiEnabled) {
          await manifestsApi.submit(id);
        } else {
          setManifests((p: any[]) =>
            p.map((m) =>
              m.id === id
                ? {
                    ...m,
                    status: 'submitted',
                    submittedAt: new Date().toISOString(),
                  }
                : m,
            ),
          );
        }
      },
      {
        failRate: apiEnabled ? 0 : 0.15,
        successMsg: 'eManifest submitted to border gateway.',
      },
    );

  const acceptManifest = (id: string) =>
    runGatewayAction(
      id,
      'Accept',
      async () => {
        if (apiEnabled) {
          await manifestsApi.accept(id);
        } else {
          setManifests((p: any[]) =>
            p.map((m) =>
              m.id === id
                ? {
                    ...m,
                    status: 'accepted',
                    acceptedAt: new Date().toISOString(),
                  }
                : m,
            ),
          );
        }
      },
      { successMsg: 'eManifest accepted.' },
    );

  const rejectManifest = (id: string) =>
    runGatewayAction(
      id,
      'Reject',
      async () => {
        if (apiEnabled) {
          await manifestsApi.reject(
            id,
            'Duplicate CCN / invalid data',
          );
        } else {
          setManifests((p: any[]) =>
            p.map((m) =>
              m.id === id
                ? {
                    ...m,
                    status: 'rejected',
                    rejectedAt: new Date().toISOString(),
                    rejectionReason: 'Duplicate CCN / invalid data',
                  }
                : m,
            ),
          );
        }
      },
      { successMsg: 'eManifest marked rejected.' },
    );

  const cancelManifest = (id: string) => {
    if (!window.confirm('Cancel this eManifest? This cannot be undone.'))
      return;
    runGatewayAction(
      id,
      'Cancellation',
      async () => {
        if (apiEnabled) {
          await manifestsApi.cancel(id);
        } else {
          setManifests((p: any[]) =>
            p.map((m) =>
              m.id === id ? { ...m, status: 'cancelled' } : m,
            ),
          );
        }
      },
      {
        failRate: apiEnabled ? 0 : 0.1,
        successMsg: 'eManifest cancelled.',
      },
    );
  };

  const deleteManifest = async (id: string) => {
    if (!window.confirm('Delete this draft eManifest permanently?')) return;
    try {
      if (apiEnabled) {
        await manifestsApi.remove(id);
        await refreshAll?.();
      } else {
        setManifests((p: any[]) => p.filter((m) => m.id !== id));
      }
      notify('Draft eManifest deleted.');
    } catch (e: any) {
      notify(e?.message || 'Delete failed', 'error');
    }
  };

  const editManifest = (m: any) => {
    setEditingManifest(m);
    setSubTab(m.type === 'ACI' ? 'new_aci' : 'new_ace');
  };

  const saveProfile = async (updated: any) => {
    try {
      if (apiEnabled) {
        await carrierProfilesApi.upsert(company.id, updated);
        await refreshAll?.();
      } else {
        setCarrierProfiles((p: any[]) => {
          const ex = p.find((x) => x.companyId === company.id);
          return ex
            ? p.map((x) =>
                x.companyId === company.id ? { ...x, ...updated } : x,
              )
            : [...p, { ...updated, companyId: company.id }];
        });
      }
    } catch (e: any) {
      notify(e?.message || 'Failed to save carrier profile', 'error');
    }
  };

  const sorted = [...manifests].sort((a, b) =>
    (b.createdAt || '') >= (a.createdAt || '') ? 1 : -1,
  );

  return (
    <div style={{ padding: '0 2px' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: G.text }}>eManifest</div>
        <div style={{ fontSize: 14, color: G.muted, marginTop: 4 }}>
          File ACI / ACE border manifests and manage carrier profile.
        </div>
      </div>

      <StatsGrid
        items={[
          {
            label: 'ACI Filed',
            value: aciCount,
            accent: G.info,
            icon: Icons.flag({ size: 20 }),
            subtitle: 'Canada-bound',
          },
          {
            label: 'ACE Filed',
            value: aceCount,
            accent: G.purple,
            icon: Icons.passport({ size: 20 }),
            subtitle: 'US-bound',
          },
          {
            label: 'Accepted',
            value: acceptedCount,
            accent: G.success,
            icon: Icons.checkCircle({ size: 20 }),
          },
          {
            label: 'Pending',
            value: pendingCount,
            accent: G.warning || G.gold,
            icon: Icons.schedule({ size: 20 }),
          },
        ]}
      />

      <div
        style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
      >
        <Btn
          variant="info"
          onClick={() => setSubTab('new_aci')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {Icons.add({ size: 18 })}
          ACI eManifest
          <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 500 }}>
            (Canada-bound)
          </span>
        </Btn>
        <Btn
          variant="purple"
          onClick={() => setSubTab('new_ace')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {Icons.add({ size: 18 })}
          ACE eManifest
          <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 500 }}>
            (US-bound)
          </span>
        </Btn>
        <Btn
          variant="outline"
          onClick={() => setSubTab('profile')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          {Icons.settings({ size: 18 })}
          Carrier Profile
        </Btn>
      </div>

      {subTab === 'profile' && (
        <CarrierProfileForm
          carrier={carrier}
          onSave={saveProfile}
          onClose={() => setSubTab('list')}
        />
      )}

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: G.text,
          marginBottom: 12,
        }}
      >
        All Manifests ({manifests.length})
      </div>

      {manifests.length === 0 && (
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.border}`,
            borderRadius: RADIUS.lg,
            padding: 50,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: G.primaryBg,
              color: G.primary,
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 12px',
            }}
          >
            {Icons.passport({ size: 24 })}
          </div>
          <div style={{ color: G.muted, fontSize: 14 }}>
            No eManifests yet. Create your first ACI or ACE manifest above.
          </div>
        </div>
      )}

      {sorted.map((m: any) => (
        <EManifestCard
          key={m.id}
          manifest={m}
          drivers={drivers}
          trucks={trucks}
          trailers={trailers}
          pending={pending[m.id]}
          error={actionError?.id === m.id ? actionError.msg : null}
          onDismissError={() => setActionError(null)}
          onSubmit={() => submitManifest(m.id)}
          onAccept={() => acceptManifest(m.id)}
          onReject={() => rejectManifest(m.id)}
          onCancel={() => cancelManifest(m.id)}
          onDelete={() => deleteManifest(m.id)}
          onEdit={() => editManifest(m)}
          onLeadSheet={() => setViewLeadSheet(m)}
        />
      ))}
    </div>
  );
}
