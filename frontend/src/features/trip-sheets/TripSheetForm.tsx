import { useState, useEffect, useMemo } from 'react';
import { G, RADIUS, page } from '@/lib/theme';
import { Btn, BackButton, Card, Inp, Sel, SectionTitle, G2, Icons } from '@/components/ui';
import { uid } from '@/lib/uid';
import { PrintPreview } from './PrintPreview';
import { companiesApi } from '@/lib/api';
import { notify } from '@/components/feedback/Toast';

const emptyTrip = () => ({
  id: uid(),
  tripNo: '',
  trailerNo: '',
  pickupDate: '',
  dropDate: '',
  from: '',
  to: '',
  notes: '',
});

const emptyExp = () => ({
  id: uid(),
  category: 'Fuel',
  description: '',
  amount: '',
  receiptNo: '',
  paidBy: 'Company Card',
});

const FALLBACK_EXPENSE = [
  'Fuel',
  'DEF',
  'Scale',
  'Tolls',
  'Wash',
  'Parking',
  'Repair',
  'Other',
];

const MIN_EXPENSE_AMOUNT = 0.01;
const MAX_EXPENSE_AMOUNT = 50000;

interface TripErrors {
  tripNo?: string;
  trailerNo?: string;
  pickupDate?: string;
  dropDate?: string;
  from?: string;
  to?: string;
}

interface ExpenseErrors {
  amount?: string;
  description?: string;
}

interface FormErrors {
  header?: {
    truckNo?: string;
    startDate?: string;
    endDate?: string;
    driver1?: string;
  };
  trips?: {
    [id: string]: TripErrors;
  };
  expenses?: {
    [id: string]: {
      description?: string;
      amount?: string;
    };
  };
  general?: string;
}

export function TripSheetForm({
  company,
  user,
  editSheet,
  onSave,
  onBack,
}: any) {
  const [init] = useState(() => ({
    hdr: editSheet?.header || {
      truckNo: user?.truckNo || '',
      startDate: '',
      endDate: '',
      driver1: user?.name || '',
      driver2: '',
    },
    trips: editSheet?.trips?.length ? editSheet.trips : [emptyTrip()],
    expenses: editSheet?.expenses?.length ? editSheet.expenses : [emptyExp()],
    notes: editSheet?.notes || '',
  }));

  const [hdr, setHdr] = useState(init.hdr);
  const [trips, setTrips] = useState<any[]>(init.trips);
  const [exps, setExps] = useState<any[]>(init.expenses);
  const [notes, setNotes] = useState(init.notes);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expCats, setExpCats] = useState<string[]>(FALLBACK_EXPENSE);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const initialSnapshot = useMemo(() => {
    if (!editSheet) return null;
    return JSON.stringify(init);
  }, [editSheet, init]);

  const isFormDirty = useMemo(() => {
    if (!editSheet || !initialSnapshot) return true;
    const current = JSON.stringify({
      hdr,
      trips,
      expenses: exps,
      notes,
    });
    return current !== initialSnapshot;
  }, [editSheet, initialSnapshot, hdr, trips, exps, notes]);

  useEffect(() => {
    if (!company?.id) return;
    void companiesApi
      .referenceData(company.id, {
        selectableOnly: true,
        kind: 'expense_category',
      })
      .then((rows) => {
        const names = (Array.isArray(rows) ? rows : [])
          .map((r: any) => String(r.name || '').trim())
          .filter(Boolean);
        if (names.length) setExpCats(names);
      })
      .catch(() => undefined);
  }, [company?.id]);

  const updH = (k: string, v: string) => {
    setHdr((h: any) => ({ ...h, [k]: v }));
    if (errors.header?.[k as keyof typeof errors.header]) {
      setErrors((prev) => ({
        ...prev,
        header: { ...prev.header, [k]: undefined },
      }));
    }
  };

  const updT = (id: string, k: string, v: string) => {
    setTrips((ts) => ts.map((t) => (t.id === id ? { ...t, [k]: v } : t)));
    if (errors.trips?.[id]?.[k as keyof TripErrors]) {
      setErrors((prev) => ({
        ...prev,
        trips: {
          ...prev.trips,
          [id]: { ...prev.trips?.[id], [k]: undefined },
        },
      }));
    }
  };

  const updE = (id: string, k: string, v: string) => {
    let finalVal = v;
    if (k === 'amount') {
      // Disallow negative sign
      if (v.includes('-')) {
        finalVal = v.replace(/-/g, '');
      }
    }

    setExps((es) => es.map((e) => (e.id === id ? { ...e, [k]: finalVal } : e)));

    if (k === 'amount') {
      if (!finalVal || !finalVal.trim()) {
        if (errors.expenses?.[id]?.amount) {
          setErrors((prev) => ({
            ...prev,
            expenses: {
              ...prev.expenses,
              [id]: { ...prev.expenses?.[id], amount: undefined },
            },
          }));
        }
        return;
      }

      const num = parseFloat(finalVal);
      if (isNaN(num) || num < MIN_EXPENSE_AMOUNT) {
        setErrors((prev) => ({
          ...prev,
          expenses: {
            ...prev.expenses,
            [id]: {
              ...prev.expenses?.[id],
              amount: `Amount must be at least $${MIN_EXPENSE_AMOUNT.toFixed(2)} (cannot be negative or zero)`,
            },
          },
        }));
        return;
      }
      if (num > MAX_EXPENSE_AMOUNT) {
        setErrors((prev) => ({
          ...prev,
          expenses: {
            ...prev.expenses,
            [id]: {
              ...prev.expenses?.[id],
              amount: `Amount cannot exceed $${MAX_EXPENSE_AMOUNT.toLocaleString('en-US')}.00`,
            },
          },
        }));
        return;
      }
      if (errors.expenses?.[id]?.amount) {
        setErrors((prev) => ({
          ...prev,
          expenses: {
            ...prev.expenses,
            [id]: { ...prev.expenses?.[id], amount: undefined },
          },
        }));
      }
      return;
    }

    if (errors.expenses?.[id]?.[k as keyof ExpenseErrors]) {
      setErrors((prev) => ({
        ...prev,
        expenses: {
          ...prev.expenses,
          [id]: { ...prev.expenses?.[id], [k]: undefined },
        },
      }));
    }
  };

  const removeTrip = (id: string) => {
    setTrips((ts) => ts.filter((x) => x.id !== id));
    setErrors((prev) => {
      const nextTrips = { ...prev.trips };
      delete nextTrips[id];
      return { ...prev, trips: nextTrips };
    });
  };

  const removeExp = (id: string) => {
    setExps((es) => es.filter((x) => x.id !== id));
    setErrors((prev) => {
      const nextExps = { ...prev.expenses };
      delete nextExps[id];
      return { ...prev, expenses: nextExps };
    });
  };

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      header: {},
      trips: {},
      expenses: {},
    };
    let hasError = false;

    // 1. Header validation
    if (!hdr.truckNo || !String(hdr.truckNo).trim()) {
      nextErrors.header!.truckNo = 'Truck Unit No. is required';
      hasError = true;
    }
    if (!hdr.startDate || !String(hdr.startDate).trim()) {
      nextErrors.header!.startDate = 'Start Date is required';
      hasError = true;
    }
    if (!hdr.endDate || !String(hdr.endDate).trim()) {
      nextErrors.header!.endDate = 'End Date is required';
      hasError = true;
    }
    if (!hdr.driver1 || !String(hdr.driver1).trim()) {
      nextErrors.header!.driver1 = 'Driver Name 1 is required';
      hasError = true;
    }

    // 2. Trip Legs validation
    if (!trips.length) {
      nextErrors.general = 'At least one trip leg is required';
      hasError = true;
    } else {
      trips.forEach((t) => {
        const tripErr: TripErrors = {};
        if (!t.tripNo || !String(t.tripNo).trim()) {
          tripErr.tripNo = 'Trip No. is required';
          hasError = true;
        }
        if (!t.trailerNo || !String(t.trailerNo).trim()) {
          tripErr.trailerNo = 'Trailer No. is required';
          hasError = true;
        }
        if (!t.pickupDate || !String(t.pickupDate).trim()) {
          tripErr.pickupDate = 'Pickup Date is required';
          hasError = true;
        }
        if (!t.dropDate || !String(t.dropDate).trim()) {
          tripErr.dropDate = 'Drop Date is required';
          hasError = true;
        }
        if (!t.from || !String(t.from).trim()) {
          tripErr.from = 'Origin (From) is required';
          hasError = true;
        }
        if (!t.to || !String(t.to).trim()) {
          tripErr.to = 'Destination (To) is required';
          hasError = true;
        }
        if (Object.keys(tripErr).length > 0) {
          nextErrors.trips![t.id] = tripErr;
        }
      });
    }

    // 3. Expenses validation
    exps.forEach((e) => {
      const expErr: ExpenseErrors = {};
      const hasAnyField = Boolean(
        (e.description && String(e.description).trim()) ||
          (e.receiptNo && String(e.receiptNo).trim()) ||
          (e.amount !== '' && e.amount !== undefined && e.amount !== null),
      );

      if (hasAnyField) {
        if (
          e.amount === '' ||
          e.amount === undefined ||
          e.amount === null ||
          !String(e.amount).trim()
        ) {
          expErr.amount = 'Amount is required for this expense';
          hasError = true;
        } else {
          const parsed = parseFloat(e.amount);
          if (isNaN(parsed)) {
            expErr.amount = 'Valid numerical amount is required';
            hasError = true;
          } else if (parsed < MIN_EXPENSE_AMOUNT) {
            expErr.amount = `Amount must be at least $${MIN_EXPENSE_AMOUNT.toFixed(2)} (cannot be negative or zero)`;
            hasError = true;
          } else if (parsed > MAX_EXPENSE_AMOUNT) {
            expErr.amount = `Amount cannot exceed $${MAX_EXPENSE_AMOUNT.toLocaleString('en-US')}.00`;
            hasError = true;
          } else if (!/^\d+(\.\d{1,2})?$/.test(String(e.amount).trim())) {
            expErr.amount = 'Amount can have at most 2 decimal places';
            hasError = true;
          }
        }

        if (!e.description || !String(e.description).trim()) {
          expErr.description = 'Description is required';
          hasError = true;
        }
      }
      if (Object.keys(expErr).length > 0) {
        nextErrors.expenses![e.id] = expErr;
      }
    });

    setErrors(nextErrors);
    return !hasError;
  };

  const save = () => {
    if (saving) return;
    setSubmitted(true);
    if (!validate()) {
      notify('Please fill in all required fields before saving.', 'error');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    // Filter out completely blank expenses
    const validExps = exps.filter(
      (e) =>
        (e.description && String(e.description).trim()) ||
        (e.receiptNo && String(e.receiptNo).trim()) ||
        (e.amount !== '' &&
          !isNaN(parseFloat(e.amount)) &&
          parseFloat(e.amount) >= MIN_EXPENSE_AMOUNT &&
          parseFloat(e.amount) <= MAX_EXPENSE_AMOUNT),
    );

    setTimeout(async () => {
      try {
        await Promise.resolve(
          onSave({
            id: editSheet?.id || uid(),
            header: hdr,
            trips,
            expenses: validExps,
            notes,
            companyId: company.id,
            driverId: user.id,
            createdAt:
              editSheet?.createdAt || new Date().toLocaleDateString('en-CA'),
            updatedAt: new Date().toLocaleDateString('en-CA'),
          }),
        );
      } catch {
        // parent notifies; keep form open for retry
      } finally {
        setSaving(false);
      }
    }, 400);
  };

  if (preview) {
    return (
      <PrintPreview
        company={company}
        header={hdr}
        trips={trips}
        expenses={exps}
        notes={notes}
        onBack={() => setPreview(false)}
      />
    );
  }

  const hasErrors =
    submitted &&
    (Boolean(errors.general) ||
      Object.keys(errors.header || {}).some((k) =>
        Boolean((errors.header as any)[k]),
      ) ||
      Object.keys(errors.trips || {}).some((id) =>
        Object.keys(errors.trips![id] || {}).some((k) =>
          Boolean((errors.trips![id] as any)[k]),
        ),
      ) ||
      Object.keys(errors.expenses || {}).some((id) =>
        Object.keys(errors.expenses![id] || {}).some((k) =>
          Boolean((errors.expenses![id] as any)[k]),
        ),
      ));

  return (
    <div style={{ ...page() }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          background: G.card,
          borderBottom: `1px solid ${G.border}`,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BackButton onClick={onBack} />
          <div>
            <span
              style={{
                fontSize: 11,
                letterSpacing: 2,
                color: G.gold,
                fontWeight: 700,
              }}
            >
              {editSheet ? 'EDIT TRIP SHEET' : 'NEW TRIP SHEET'}
            </span>
            {hdr.truckNo && (
              <span style={{ fontSize: 10, color: G.muted, marginLeft: 8 }}>
                Truck #{hdr.truckNo}
              </span>
            )}
          </div>
        </div>
        <Btn
          onClick={save}
          loading={saving}
          loadingLabel="Saving…"
          disabled={saving || (Boolean(editSheet) && !isFormDirty)}
          style={{ padding: '9px 18px' }}
        >
          SAVE
        </Btn>
      </div>

      <div
        style={{
          padding: '16px 14px 100px',
          maxWidth: 700,
          margin: '0 auto',
        }}
      >
        {hasErrors && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${G.danger}`,
              borderRadius: RADIUS.md,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: G.danger,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.15)',
            }}
          >
            <div style={{ flexShrink: 0, lineHeight: 0 }}>
              {Icons.alert({ size: 20, color: G.danger })}
            </div>
            <div>
              {errors.general ||
                'Cannot save empty trip sheet. Please fill in all required fields marked in red.'}
            </div>
          </div>
        )}

        <Card>
          <SectionTitle>TRUCK & DRIVER INFO</SectionTitle>
          <G2 cols={2}>
            <Inp
              label="Truck Unit No."
              required
              error={errors.header?.truckNo}
              value={hdr.truckNo}
              onChange={(e) => updH('truckNo', e.target.value)}
              placeholder="e.g. 32054"
            />
            <Inp
              label="Start Date"
              type="text"
              required
              error={errors.header?.startDate}
              value={hdr.startDate}
              onChange={(e) => updH('startDate', e.target.value)}
              placeholder="e.g. 4 May 2026"
            />
          </G2>
          <G2 cols={2}>
            <Inp
              label="End Date"
              type="text"
              required
              error={errors.header?.endDate}
              value={hdr.endDate}
              onChange={(e) => updH('endDate', e.target.value)}
              placeholder="e.g. 12 May 2026"
            />
            <Inp
              label="Driver Name 1"
              required
              error={errors.header?.driver1}
              value={hdr.driver1}
              onChange={(e) => updH('driver1', e.target.value)}
            />
          </G2>
          <Inp
            label="Driver Name 2 (Co-Driver)"
            value={hdr.driver2}
            onChange={(e) => updH('driver2', e.target.value)}
            placeholder="Optional"
          />
        </Card>

        <Card>
          <SectionTitle>TRIP INFORMATION</SectionTitle>
          {errors.general && (
            <div
              style={{
                color: G.danger,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {errors.general}
            </div>
          )}
          {trips.map((t, i) => (
            <div
              key={t.id}
              style={{
                background: G.card2,
                border: `1px solid ${
                  errors.trips?.[t.id] &&
                  Object.keys(errors.trips[t.id]).length > 0
                    ? G.danger
                    : G.border2
                }`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: G.gold,
                    color: G.onGold,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {i + 1}
                </div>
                {trips.length > 1 && (
                  <Btn
                    variant="danger"
                    style={{ padding: '4px 10px', fontSize: 10 }}
                    onClick={() => removeTrip(t.id)}
                  >
                    REMOVE
                  </Btn>
                )}
              </div>
              <G2 cols={2}>
                <Inp
                  label="Trip No."
                  required
                  error={errors.trips?.[t.id]?.tripNo}
                  value={t.tripNo}
                  onChange={(e) => updT(t.id, 'tripNo', e.target.value)}
                  placeholder="e.g. 34320"
                />
                <Inp
                  label="Trailer No."
                  required
                  error={errors.trips?.[t.id]?.trailerNo}
                  value={t.trailerNo}
                  onChange={(e) => updT(t.id, 'trailerNo', e.target.value)}
                  placeholder="e.g. DV1767"
                />
              </G2>
              <G2 cols={2}>
                <Inp
                  label="Pickup Date"
                  type="text"
                  required
                  error={errors.trips?.[t.id]?.pickupDate}
                  value={t.pickupDate}
                  onChange={(e) => updT(t.id, 'pickupDate', e.target.value)}
                  placeholder="e.g. 4 May"
                />
                <Inp
                  label="Drop Date"
                  type="text"
                  required
                  error={errors.trips?.[t.id]?.dropDate}
                  value={t.dropDate}
                  onChange={(e) => updT(t.id, 'dropDate', e.target.value)}
                  placeholder="e.g. 7 May"
                />
              </G2>
              <G2 cols={2}>
                <Inp
                  label="From"
                  required
                  error={errors.trips?.[t.id]?.from}
                  value={t.from}
                  onChange={(e) => updT(t.id, 'from', e.target.value)}
                  placeholder="e.g. Calgary, AB"
                />
                <Inp
                  label="To"
                  required
                  error={errors.trips?.[t.id]?.to}
                  value={t.to}
                  onChange={(e) => updT(t.id, 'to', e.target.value)}
                  placeholder="e.g. Toronto, ON"
                />
              </G2>
              <Inp
                label="Notes (e.g. 36hr reset)"
                value={t.notes}
                onChange={(e) => updT(t.id, 'notes', e.target.value)}
                placeholder="Optional"
              />
            </div>
          ))}
          <button
            style={{
              background: 'transparent',
              border: `1px dashed ${G.gold}`,
              color: G.gold,
              borderRadius: 8,
              padding: 12,
              width: '100%',
              fontSize: 12,
              cursor: 'pointer',
            }}
            onClick={() => setTrips((ts) => [...ts, emptyTrip()])}
          >
            + ADD TRIP LEG
          </button>
        </Card>

        <Card>
          <SectionTitle>EXPENSE SHEET</SectionTitle>
          {exps.map((e, i) => (
            <div
              key={e.id}
              style={{
                background: G.card2,
                border: `1px solid ${
                  errors.expenses?.[e.id] &&
                  Object.keys(errors.expenses[e.id]).length > 0
                    ? G.danger
                    : G.border2
                }`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: G.gold,
                    color: G.onGold,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 12,
                  }}
                >
                  {i + 1}
                </div>
                {exps.length > 1 && (
                  <Btn
                    variant="danger"
                    style={{ padding: '4px 10px', fontSize: 10 }}
                    onClick={() => removeExp(e.id)}
                  >
                    REMOVE
                  </Btn>
                )}
              </div>
              <G2 cols={2}>
                <Sel
                  label="Category"
                  value={e.category}
                  onChange={(ev) => updE(e.id, 'category', ev.target.value)}
                >
                  {expCats.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Sel>
                <Inp
                  label="Description"
                  error={errors.expenses?.[e.id]?.description}
                  value={e.description}
                  onChange={(ev) => updE(e.id, 'description', ev.target.value)}
                  placeholder="Details..."
                />
              </G2>
              <G2 cols={2}>
                <Inp
                  label="Receipt #"
                  value={e.receiptNo}
                  onChange={(ev) => updE(e.id, 'receiptNo', ev.target.value)}
                  placeholder="e.g. R-001"
                />
                <Inp
                  label="Amount"
                  type="number"
                  min={MIN_EXPENSE_AMOUNT}
                  max={MAX_EXPENSE_AMOUNT}
                  step="0.01"
                  error={errors.expenses?.[e.id]?.amount}
                  value={e.amount}
                  onChange={(ev) => updE(e.id, 'amount', ev.target.value)}
                  placeholder="0.00"
                />
              </G2>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 2,
                    color: G.muted,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  Currency
                </div>
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: `1px solid ${G.border2}`,
                  }}
                >
                  {['CAD', 'USD'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updE(e.id, 'currency', c)}
                      style={{
                        flex: 1,
                        padding: '11px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12,
                        background: e.currency === c ? G.gold : G.card2,
                        color: e.currency === c ? G.onGold : G.muted,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <button
            style={{
              background: 'transparent',
              border: `1px dashed ${G.gold}`,
              color: G.gold,
              borderRadius: 8,
              padding: 12,
              width: '100%',
              fontSize: 12,
              cursor: 'pointer',
            }}
            onClick={() => setExps((es) => [...es, emptyExp()])}
          >
            + ADD EXPENSE
          </button>
        </Card>

        <Card>
          <SectionTitle>NOTES</SectionTitle>
          <textarea
            style={{
              width: '100%',
              background: G.inset,
              border: `1px solid ${G.border2}`,
              borderRadius: 8,
              padding: '12px 14px',
              color: G.text,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
              minHeight: 70,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="General notes..."
          />
        </Card>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: G.card,
          borderTop: `1px solid ${G.border}`,
          padding: '12px 16px',
          display: 'flex',
          gap: 12,
          zIndex: 300,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Btn
          variant="ghost"
          style={{
            flex: 1,
            padding: 13,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onClick={() => setPreview(true)}
        >
          {Icons.eye({ size: 16, color: G.muted })} VIEW / PDF
        </Btn>
        <Btn
          disabled={saving || (Boolean(editSheet) && !isFormDirty)}
          style={{ flex: 1, padding: 13 }}
          onClick={save}
        >
          {saving ? 'SAVING…' : 'SAVE SHEET'}
        </Btn>
      </div>
    </div>
  );
}
