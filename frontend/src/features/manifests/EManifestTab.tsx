import { useState } from 'react';
import { G } from '@/lib/theme';
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4,1fr)',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          ['ACI Filed', aciCount, G.info],
          ['ACE Filed', aceCount, G.purple],
          ['Accepted', acceptedCount, G.success],
          ['Pending', pendingCount, G.gold],
        ].map(([l, v, c]) => (
          <div
            key={l as string}
            style={{
              background: G.card,
              border: `1px solid ${G.border}`,
              borderRadius: 10,
              padding: '12px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: c as string }}>
              {v as number}
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: 1.5,
                color: G.muted,
                marginTop: 2,
                textTransform: 'uppercase',
              }}
            >
              {l as string}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}
      >
        <button
          onClick={() => setSubTab('new_aci')}
          style={{
            background: G.infoTint,
            border: `1px solid ${G.info}`,
            color: G.info,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          🛃 + ACI eManifest{' '}
          <span style={{ fontSize: 10, opacity: 0.7 }}>(Canada-bound)</span>
        </button>
        <button
          onClick={() => setSubTab('new_ace')}
          style={{
            background: G.purpleBg,
            border: `1px solid ${G.purple}`,
            color: G.purple,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          🦅 + ACE eManifest{' '}
          <span style={{ fontSize: 10, opacity: 0.7 }}>(US-bound)</span>
        </button>
        <button
          onClick={() => setSubTab('profile')}
          style={{
            background: 'transparent',
            border: `1px solid ${G.border2}`,
            color: G.muted,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 12,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          ⚙️ CARRIER PROFILE
        </button>
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
          fontSize: 10,
          letterSpacing: 3,
          color: G.muted,
          marginBottom: 10,
        }}
      >
        ALL MANIFESTS ({manifests.length})
      </div>

      {manifests.length === 0 && (
        <div
          style={{
            background: G.card,
            border: `1px solid ${G.border}`,
            borderRadius: 12,
            padding: 50,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>🛃</div>
          <div style={{ color: G.muted }}>
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
