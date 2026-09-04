import { useEffect, useRef, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, Pill, SectionTitle, G2, Divider } from '@/components/ui';
import { companiesApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';
import { useConfirm } from '@/context/ConfirmContext';

type Kind =
  | 'import'
  | 'locations'
  | 'brokers'
  | 'customers'
  | 'consignees'
  | 'carriers'
  | 'commodities'
  | 'warehouses'
  | 'ports'
  | 'vendors'
  | 'fuel'
  | 'insurance'
  | 'costcenters'
  | 'payroll'
  | 'refs';

const IO_KINDS = ['brokers', 'customers', 'locations', 'commodities'] as const;
type IoKind = (typeof IO_KINDS)[number];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type DupSuggestion = { id: string; name: string; reason: string; status?: string };

const PARTY_STATUSES = [
  'active',
  'inactive',
  'suspended',
  'blacklisted',
  'watch',
] as const;

const CATALOG_STATUSES = ['active', 'inactive'] as const;

const EMPTY_FORM: Record<string, string> = {
  name: '',
  mc: '',
  phone: '',
  email: '',
  city: '',
  line1: '',
  region: '',
  postal: '',
  country: 'CA',
  status: 'active',
  insuranceExpiry: '',
  safetyRating: '',
  nmfc: '',
  hazmat: 'false',
  locationId: '',
  hours: '',
  docks: '',
  code: '',
  brand: '',
  kind: 'expense_category',
  notes: '',
};

function rowTitle(kind: Kind, r: any): string {
  if (kind === 'ports') return `${r.code || '—'} · ${r.name || '(unnamed)'}`;
  if (kind === 'locations') {
    const parts = [r.name, r.city, r.region].filter(Boolean);
    return parts.join(', ') || '(unnamed)';
  }
  return r.name || r.code || '(unnamed)';
}

function rowMeta(kind: Kind, r: any): string {
  const bits: string[] = [];
  if (kind === 'brokers' || kind === 'carriers') {
    if (r.mc) bits.push(`MC ${r.mc}`);
    if (r.dot) bits.push(`DOT ${r.dot}`);
  }
  if (kind === 'commodities') {
    if (r.nmfc) bits.push(`NMFC ${r.nmfc}`);
    if (r.hazmat) bits.push('HAZMAT');
  }
  if (kind === 'warehouses' && r.hours) bits.push(r.hours);
  if (kind === 'fuel' && r.brand) bits.push(r.brand);
  if (kind === 'costcenters' || kind === 'payroll' || kind === 'refs') {
    if (r.code) bits.push(r.code);
  }
  if (kind === 'refs' && r.kind) bits.push(r.kind);
  if (r.phone) bits.push(r.phone);
  if (r.email) bits.push(r.email);
  if (kind === 'ports' && r.borderCrossingName) bits.push(r.borderCrossingName);
  if (kind === 'ports' && r.country) bits.push(r.country);
  return bits.join(' · ');
}

const MERGEABLE: Kind[] = [
  'locations',
  'brokers',
  'customers',
  'consignees',
  'carriers',
];

const KIND_ENTITY: Partial<Record<Kind, string>> = {
  locations: 'Location',
  brokers: 'Broker',
  customers: 'Customer',
  consignees: 'Consignee',
  carriers: 'Carrier',
};

export function MasterDataPanel({ companyId }: { companyId: string }) {
  const confirm = useConfirm();
  const loadSeq = useRef(0);
  const [kind, setKind] = useState<Kind>('brokers');
  const [rows, setRows] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [dupHint, setDupHint] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');
  const [dups, setDups] = useState<DupSuggestion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ioEntity, setIoEntity] = useState<IoKind>('brokers');
  const [csvText, setCsvText] = useState('');
  const [ioReport, setIoReport] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY_FORM });

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
  };

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setDupHint('');
    setDups([]);
    setLastCreatedId('');
    setForm({
      ...EMPTY_FORM,
      name: r.name || '',
      mc: r.mc || '',
      phone: r.phone || '',
      email: r.email || '',
      city: r.city || '',
      line1: r.line1 || '',
      region: r.region || '',
      postal: r.postal || '',
      country: r.country || 'CA',
      status: r.status || 'active',
      insuranceExpiry: r.insuranceExpiry
        ? String(r.insuranceExpiry).slice(0, 10)
        : '',
      safetyRating: r.safetyRating || '',
      nmfc: r.nmfc || '',
      hazmat: r.hazmat ? 'true' : 'false',
      locationId: r.locationId || '',
      hours: r.hours || '',
      docks: r.docks != null ? String(r.docks) : '',
      code: r.code || '',
      brand: r.brand || '',
      kind: r.kind || 'expense_category',
      notes: r.notes || '',
    });
  };

  const load = async () => {
    const seq = ++loadSeq.current;
    if (kind === 'import') {
      setRows([]);
      return;
    }
    try {
      setBusy(true);
      let list: any[] = [];
      if (kind === 'locations') list = await companiesApi.locations(companyId);
      else if (kind === 'brokers') list = await companiesApi.brokers(companyId);
      else if (kind === 'customers')
        list = await companiesApi.customers(companyId);
      else if (kind === 'consignees')
        list = await companiesApi.consignees(companyId);
      else if (kind === 'carriers')
        list = await companiesApi.carriers(companyId);
      else if (kind === 'commodities')
        list = await companiesApi.commodities(companyId);
      else if (kind === 'warehouses')
        list = await companiesApi.warehouses(companyId);
      else if (kind === 'vendors')
        list = await companiesApi.maintenanceVendors(companyId);
      else if (kind === 'fuel') list = await companiesApi.fuelStations(companyId);
      else if (kind === 'insurance')
        list = await companiesApi.insuranceProviders(companyId);
      else if (kind === 'costcenters')
        list = await companiesApi.costCenters(companyId);
      else if (kind === 'payroll')
        list = await companiesApi.payrollCategories(companyId);
      else if (kind === 'refs') list = await companiesApi.referenceData(companyId);
      else list = await companiesApi.portsOfEntry(companyId);

      if (seq !== loadSeq.current) return;

      setRows(Array.isArray(list) ? list : []);
      if (kind === 'warehouses') {
        const locs = await companiesApi.locations(companyId).catch(() => []);
        if (seq !== loadSeq.current) return;
        setLocations(Array.isArray(locs) ? locs : []);
      }
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      notify(e?.message || 'Failed to load master data', 'error');
      setRows([]);
    } finally {
      if (seq === loadSeq.current) setBusy(false);
    }
  };

  useEffect(() => {
    setRows([]);
    setDupHint('');
    setDups([]);
    setLastCreatedId('');
    resetForm();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, kind]);

  const exportKind = async (entity: IoKind) => {
    try {
      setBusy(true);
      const res = await companiesApi.exportMdm(companyId, entity);
      downloadCsv(res.filename || `mdm-${entity}.csv`, res.csv || '');
      notify(`Exported ${entity}`, 'success');
    } catch (e: any) {
      notify(e?.message || 'Export failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!csvText.trim()) {
      notify('Paste or choose a CSV file first', 'error');
      return;
    }
    try {
      setBusy(true);
      const res = await companiesApi.importMdm(companyId, {
        entity: ioEntity,
        csv: csvText,
        dryRun,
      });
      setIoReport(res);
      if (dryRun) {
        notify(
          `Dry-run: ${res.wouldCreate ?? 0} new, ${res.skipped} skipped, ${res.errorCount} errors`,
          res.errorCount ? 'error' : 'success',
        );
      } else {
        notify(
          `Imported ${res.created} · skipped ${res.skipped} · ${res.errorCount} errors`,
          res.errorCount ? 'error' : 'success',
        );
      }
    } catch (e: any) {
      notify(e?.message || 'Import failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const updateRecord = async (id: string) => {
    try {
      setBusy(true);
      if (kind === 'locations') {
        await companiesApi.patchLocation(companyId, id, {
          name: form.name || form.city || 'Location',
          line1: form.line1,
          city: form.city,
          region: form.region,
          postal: form.postal,
          country: form.country || 'CA',
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'brokers') {
        await companiesApi.patchBroker(companyId, id, {
          name: form.name,
          mc: form.mc,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
      } else if (kind === 'customers') {
        await companiesApi.patchCustomer(companyId, id, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
      } else if (kind === 'consignees') {
        await companiesApi.patchConsignee(companyId, id, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
      } else if (kind === 'carriers') {
        await companiesApi.patchCarrier(companyId, id, {
          name: form.name,
          mc: form.mc,
          phone: form.phone,
          email: form.email,
          insuranceExpiry: form.insuranceExpiry,
          safetyRating: form.safetyRating,
          status: form.status,
        });
      } else if (kind === 'commodities') {
        await companiesApi.patchCommodity(companyId, id, {
          name: form.name,
          nmfc: form.nmfc,
          hazmat: form.hazmat === 'true',
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'vendors') {
        await companiesApi.patchMaintenanceVendor(companyId, id, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'fuel') {
        await companiesApi.patchFuelStation(companyId, id, {
          name: form.name,
          brand: form.brand,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'insurance') {
        await companiesApi.patchInsuranceProvider(companyId, id, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'costcenters') {
        await companiesApi.patchCostCenter(companyId, id, {
          name: form.name,
          code: form.code,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'payroll') {
        await companiesApi.patchPayrollCategory(companyId, id, {
          name: form.name,
          code: form.code,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'refs') {
        await companiesApi.patchReferenceData(companyId, id, {
          name: form.name,
          code: form.code,
          kind: form.kind || 'expense_category',
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'warehouses') {
        await companiesApi.patchWarehouse(companyId, id, {
          name: form.name,
          locationId: form.locationId || null,
          hours: form.hours,
          docks: form.docks,
          phone: form.phone,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'ports') {
        await companiesApi.patchPortOfEntry(companyId, id, {
          status: form.status === 'inactive' ? 'inactive' : 'active',
          notes: form.notes,
        });
      }
      notify('Updated');
      resetForm();
      await load();
    } catch (e: any) {
      notify(e?.message || 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveRecord = async () => {
    if (kind === 'import') return;
    if (kind === 'ports' && !editingId) {
      notify('Official port codes are seeded — edit status/notes only', 'error');
      return;
    }
    if (!form.name.trim() && kind !== 'locations' && kind !== 'ports') {
      notify('Name is required', 'error');
      return;
    }
    if (editingId) {
      await updateRecord(editingId);
      return;
    }
    await create();
  };

  const archiveRecord = async (id: string, label: string) => {
    const ok = await confirm({
      title: 'Archive record',
      message: `Archive "${label}"? It will no longer be selectable for new dispatch or invoices.`,
      confirmLabel: 'Archive',
      variant: 'danger',
    });
    if (!ok) return;
    await setStatus(id, 'inactive');
  };

  const create = async () => {
    if (kind === 'import') return;
    if (kind === 'ports') {
      notify('Official port codes are seeded — edit status/notes only', 'error');
      return;
    }
    if (!form.name.trim() && kind !== 'locations') {
      notify('Name is required', 'error');
      return;
    }
    try {
      setBusy(true);
      setDupHint('');
      setDups([]);
      let res: any;
      if (kind === 'locations') {
        res = await companiesApi.createLocation(companyId, {
          name: form.name || form.city || 'Location',
          line1: form.line1,
          city: form.city,
          region: form.region,
          postal: form.postal,
          country: form.country || 'CA',
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'brokers') {
        res = await companiesApi.createBroker(companyId, {
          name: form.name,
          mc: form.mc,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
      } else if (kind === 'customers') {
        res = await companiesApi.createCustomer(companyId, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
      } else if (kind === 'consignees') {
        res = await companiesApi.createConsignee(companyId, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
      } else if (kind === 'carriers') {
        res = await companiesApi.createCarrier(companyId, {
          name: form.name,
          mc: form.mc,
          phone: form.phone,
          email: form.email,
          insuranceExpiry: form.insuranceExpiry,
          safetyRating: form.safetyRating,
          status: form.status,
        });
      } else if (kind === 'commodities') {
        res = await companiesApi.createCommodity(companyId, {
          name: form.name,
          nmfc: form.nmfc,
          hazmat: form.hazmat === 'true',
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'vendors') {
        res = await companiesApi.createMaintenanceVendor(companyId, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'fuel') {
        res = await companiesApi.createFuelStation(companyId, {
          name: form.name,
          brand: form.brand,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'insurance') {
        res = await companiesApi.createInsuranceProvider(companyId, {
          name: form.name,
          phone: form.phone,
          email: form.email,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'costcenters') {
        res = await companiesApi.createCostCenter(companyId, {
          name: form.name,
          code: form.code,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'payroll') {
        res = await companiesApi.createPayrollCategory(companyId, {
          name: form.name,
          code: form.code,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else if (kind === 'refs') {
        res = await companiesApi.createReferenceData(companyId, {
          name: form.name,
          code: form.code,
          kind: form.kind || 'expense_category',
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      } else {
        res = await companiesApi.createWarehouse(companyId, {
          name: form.name,
          locationId: form.locationId || null,
          hours: form.hours,
          docks: form.docks,
          phone: form.phone,
          status: form.status === 'inactive' ? 'inactive' : 'active',
        });
      }
      const suggestions = (res?.duplicateSuggestions || []) as DupSuggestion[];
      setLastCreatedId(res?.id || '');
      setDups(suggestions);
      if (suggestions.length && MERGEABLE.includes(kind)) {
        setDupHint(
          `Possible duplicates found. Keep the new record, or merge an existing one into it (or vice versa).`,
        );
      }
      setForm((f) => ({
        ...f,
        name: '',
        mc: '',
        phone: '',
        email: '',
        city: '',
        line1: '',
        region: '',
        postal: '',
        insuranceExpiry: '',
        safetyRating: '',
        nmfc: '',
        hazmat: 'false',
        locationId: '',
        hours: '',
        docks: '',
        code: '',
        brand: '',
      }));
      notify('Saved');
      resetForm();
      await load();
    } catch (e: any) {
      notify(e?.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      if (kind === 'locations') {
        await companiesApi.patchLocation(companyId, id, { status });
      } else if (kind === 'brokers') {
        await companiesApi.patchBroker(companyId, id, { status });
      } else if (kind === 'customers') {
        await companiesApi.patchCustomer(companyId, id, { status });
      } else if (kind === 'consignees') {
        await companiesApi.patchConsignee(companyId, id, { status });
      } else if (kind === 'carriers') {
        await companiesApi.patchCarrier(companyId, id, { status });
      } else if (kind === 'commodities') {
        await companiesApi.patchCommodity(companyId, id, { status });
      } else if (kind === 'warehouses') {
        await companiesApi.patchWarehouse(companyId, id, { status });
      } else if (kind === 'vendors') {
        await companiesApi.patchMaintenanceVendor(companyId, id, { status });
      } else if (kind === 'fuel') {
        await companiesApi.patchFuelStation(companyId, id, { status });
      } else if (kind === 'insurance') {
        await companiesApi.patchInsuranceProvider(companyId, id, { status });
      } else if (kind === 'costcenters') {
        await companiesApi.patchCostCenter(companyId, id, { status });
      } else if (kind === 'payroll') {
        await companiesApi.patchPayrollCategory(companyId, id, { status });
      } else if (kind === 'refs') {
        await companiesApi.patchReferenceData(companyId, id, { status });
      } else {
        await companiesApi.patchPortOfEntry(companyId, id, { status });
      }
      await load();
    } catch (e: any) {
      notify(e?.message || 'Update failed', 'error');
    }
  };

  const merge = async (survivorId: string, absorbId: string) => {
    const entityType = KIND_ENTITY[kind];
    if (!entityType) return;
    const ok = await confirm({
      title: 'Merge records',
      message:
        'Merge these records? The absorbed record will be archived inactive.',
      confirmLabel: 'Merge',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setBusy(true);
      await companiesApi.mergeMdm(companyId, {
        entityType,
        survivorId,
        absorbId,
      });
      notify('Merged — absorb archived');
      setDups([]);
      setDupHint('');
      setLastCreatedId('');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Merge failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const statusOpts =
    kind === 'locations' ||
    kind === 'commodities' ||
    kind === 'warehouses' ||
    kind === 'ports' ||
    kind === 'vendors' ||
    kind === 'fuel' ||
    kind === 'insurance' ||
    kind === 'costcenters' ||
    kind === 'payroll' ||
    kind === 'refs'
      ? CATALOG_STATUSES
      : PARTY_STATUSES;

  return (
    <Card>
      <SectionTitle>Master data</SectionTitle>
      <div style={{ color: G.muted, fontSize: 12, marginBottom: 12 }}>
        Parties, catalogs, CA–US ports, and ops/finance refs (vendors, fuel
        stations, insurance, cost centers). Inactive / OOS / blacklisted masters
        cannot be selected for new dispatch or invoices. Fuel stations store
        location only — no live pricing. CSV import/export covers brokers,
        customers, locations, and commodities.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {(
          [
            ['import', 'Import / export'],
            ['ports', 'Ports of entry'],
            ['vendors', 'Vendors'],
            ['fuel', 'Fuel stations'],
            ['insurance', 'Insurance'],
            ['costcenters', 'Cost centers'],
            ['payroll', 'Payroll cats'],
            ['refs', 'Reference'],
            ['commodities', 'Commodities'],
            ['warehouses', 'Warehouses'],
            ['brokers', 'Brokers'],
            ['carriers', 'Carriers'],
            ['customers', 'Customers'],
            ['consignees', 'Consignees'],
            ['locations', 'Locations'],
          ] as const
        ).map(([id, label]) => (
          <Btn
            key={id}
            variant={kind === id ? undefined : 'outline'}
            onClick={() => {
              if (kind !== id) setKind(id);
            }}
          >
            {label}
          </Btn>
        ))}
      </div>

      {kind === 'import' && (
        <>
          <G2 cols={2}>
            <Sel
              label="Entity"
              value={ioEntity}
              onChange={(e: any) => {
                setIoEntity(e.target.value);
                setIoReport(null);
              }}
            >
              {IO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Sel>
            <div>
              <div style={{ fontSize: 12, color: G.muted, marginBottom: 6 }}>
                CSV file
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => setCsvText(String(reader.result || ''));
                  reader.readAsText(f);
                }}
              />
            </div>
          </G2>
          <div style={{ margin: '12px 0' }}>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 6 }}>
              CSV (header row required)
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              spellCheck={false}
              style={{
                width: '100%',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 12,
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${G.border}`,
                background: G.card,
                color: G.text,
              }}
              placeholder="name,mc,dot,..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <Btn
              variant="outline"
              disabled={busy}
              onClick={() => void exportKind(ioEntity)}
            >
              Export current
            </Btn>
            <Btn
              variant="outline"
              disabled={busy}
              onClick={() => void runImport(true)}
            >
              Dry-run
            </Btn>
            <Btn disabled={busy} onClick={() => void runImport(false)}>
              Import
            </Btn>
          </div>
          {ioReport && (
            <div style={{ fontSize: 13, marginBottom: 16, color: G.muted }}>
              {ioReport.dryRun ? 'Dry-run' : 'Committed'}: would create{' '}
              {ioReport.wouldCreate ?? ioReport.created}, skipped {ioReport.skipped},{' '}
              {ioReport.errorCount} errors.
              {Array.isArray(ioReport.errors) && ioReport.errors.length > 0 && (
                <ul style={{ marginTop: 8 }}>
                  {ioReport.errors.slice(0, 25).map((err: any, i: number) => (
                    <li key={i}>
                      Row {err.row} · {err.field}: {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Divider />
        </>
      )}

      {kind !== 'import' && (kind !== 'ports' || editingId) && (
        <>
          {editingId ? (
            <div
              style={{
                fontSize: 12,
                color: G.gold,
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              Editing record — save or cancel to finish.
            </div>
          ) : null}
          <G2 cols={kind === 'locations' || kind === 'warehouses' ? 3 : 2}>
            {kind !== 'ports' && (
              <Inp
                label={kind === 'locations' ? 'Name (optional)' : 'Name *'}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            )}
            {(kind === 'costcenters' ||
              kind === 'payroll' ||
              kind === 'refs') && (
              <Inp
                label="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            )}
            {kind === 'refs' && (
              <Inp
                label="Kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
                placeholder="expense_category"
              />
            )}
            {kind === 'fuel' && (
              <Inp
                label="Brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            )}
            {(kind === 'brokers' || kind === 'carriers') && (
              <Inp
                label="MC #"
                value={form.mc}
                onChange={(e) => setForm({ ...form, mc: e.target.value })}
              />
            )}
            {kind === 'commodities' && (
              <>
                <Inp
                  label="NMFC"
                  value={form.nmfc}
                  onChange={(e) => setForm({ ...form, nmfc: e.target.value })}
                />
                <Sel
                  label="Hazmat"
                  value={form.hazmat}
                  onChange={(e: any) =>
                    setForm({ ...form, hazmat: e.target.value })
                  }
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Sel>
              </>
            )}
            {kind === 'warehouses' && (
              <>
                <Sel
                  label="Location"
                  value={form.locationId}
                  onChange={(e: any) =>
                    setForm({ ...form, locationId: e.target.value })
                  }
                >
                  <option value="">— Optional —</option>
                  {locations.map((loc: any) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name || loc.city}
                    </option>
                  ))}
                </Sel>
                <Inp
                  label="Hours"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                />
                <Inp
                  label="Docks"
                  value={form.docks}
                  onChange={(e) => setForm({ ...form, docks: e.target.value })}
                />
              </>
            )}
            {kind === 'locations' && (
              <>
                <Inp
                  label="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <Inp
                  label="Address"
                  value={form.line1}
                  onChange={(e) => setForm({ ...form, line1: e.target.value })}
                />
              </>
            )}
            {kind !== 'locations' &&
              kind !== 'commodities' &&
              kind !== 'warehouses' &&
              kind !== 'ports' && (
                <>
                  <Inp
                    label="Phone"
                    phone
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(403) 555-0100"
                  />
                  {(kind === 'brokers' ||
                    kind === 'customers' ||
                    kind === 'consignees' ||
                    kind === 'carriers' ||
                    kind === 'vendors' ||
                    kind === 'insurance') && (
                    <Inp
                      label="Email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  )}
                </>
              )}
            {kind === 'carriers' && (
              <>
                <Inp
                  label="Insurance expiry"
                  type="date"
                  value={form.insuranceExpiry}
                  onChange={(e) =>
                    setForm({ ...form, insuranceExpiry: e.target.value })
                  }
                />
                <Inp
                  label="Safety rating"
                  value={form.safetyRating}
                  onChange={(e) =>
                    setForm({ ...form, safetyRating: e.target.value })
                  }
                />
              </>
            )}
            {kind === 'ports' && editingId && (
              <Inp
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            )}
            <Sel
              label="Status"
              value={form.status}
              onChange={(e: any) => setForm({ ...form, status: e.target.value })}
            >
              {statusOpts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Sel>
          </G2>
          {dupHint && (
            <div style={{ color: G.gold, fontSize: 12, marginBottom: 8 }}>
              {dupHint}
            </div>
          )}
          {MERGEABLE.includes(kind) && dups.length > 0 && lastCreatedId && (
            <div style={{ marginBottom: 12, fontSize: 13 }}>
              {dups.map((d) => (
                <div key={d.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span>
                    {d.name} ({d.reason})
                  </span>
                  <Btn
                    size="sm"
                    variant="outline"
                    onClick={() => void merge(lastCreatedId, d.id)}
                  >
                    Keep new · absorb this
                  </Btn>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={() => void saveRecord()} disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add'}
            </Btn>
            {editingId ? (
              <Btn variant="outline" disabled={busy} onClick={resetForm}>
                Cancel
              </Btn>
            ) : null}
            {!editingId && IO_KINDS.includes(kind as IoKind) && (
              <Btn
                variant="outline"
                disabled={busy}
                onClick={() => void exportKind(kind as IoKind)}
              >
                Export CSV
              </Btn>
            )}
          </div>
          <Divider />
        </>
      )}

      {kind !== 'import' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {busy && !rows.length && (
          <div style={{ color: G.muted, fontSize: 13 }}>Loading…</div>
        )}
        {!busy && !rows.length && (
          <div style={{ color: G.muted, fontSize: 13 }}>
            {kind === 'ports'
              ? 'No ports yet — run schema migrate to seed CA–US ports.'
              : 'No records yet.'}
          </div>
        )}
        {rows.map((r) => {
          const title = rowTitle(kind, r);
          const meta = rowMeta(kind, r);
          const isEditing = editingId === r.id;
          return (
          <div
            key={r.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
              fontSize: 13,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${isEditing ? G.gold : G.border}`,
              background: isEditing ? G.goldBg : G.card,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{title}</strong>
              {meta ? (
                <div style={{ color: G.muted, fontSize: 12, marginTop: 4 }}>
                  {meta}
                </div>
              ) : null}
              {kind === 'ports' && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {r.ace && <Pill>ACE</Pill>}
                  {r.aci && <Pill>ACI</Pill>}
                  {r.paps && <Pill>PAPS</Pill>}
                  {r.pars && <Pill>PARS</Pill>}
                  {r.fastLane && <Pill>FAST</Pill>}
                </div>
              )}
              <div style={{ marginTop: 6 }}>
                <Pill
                  color={
                    r.status === 'active' || r.status === 'watch'
                      ? G.success
                      : G.danger
                  }
                >
                  {String(r.status || '').toUpperCase()}
                </Pill>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'flex-end',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => startEdit(r)}
                >
                  Edit
                </Btn>
                {r.status !== 'inactive' && (
                  <Btn
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => void archiveRecord(r.id, title)}
                  >
                    Archive
                  </Btn>
                )}
              </div>
              <Sel
                label=""
                value={r.status}
                onChange={(e: any) => void setStatus(r.id, e.target.value)}
              >
                {statusOpts.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Sel>
            </div>
          </div>
          );
        })}
      </div>
      )}
    </Card>
  );
}
