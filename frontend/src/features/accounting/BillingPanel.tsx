import { useEffect, useState } from 'react';
import { G, RADIUS } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill, Skeleton } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank, formatLoadLabel, humanizeEnum, getApiErrorMessage } from '@/lib/format';
// getApiErrorMessage imported below
import {
  invoicesApi,
  billsApi,
  paymentsApi,
  accountsApi,
  auditApi,
  companiesApi,
} from '@/lib/api';

function getAccountTypeBadge(type: string) {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'asset':
      return { bg: G.infoBg, color: G.info, label: 'Asset' };
    case 'liability':
      return { bg: G.warningBg, color: G.warning, label: 'Liability' };
    case 'equity':
      return { bg: G.purpleBg, color: G.purple, label: 'Equity' };
    case 'revenue':
      return { bg: G.successBg, color: G.success, label: 'Revenue' };
    case 'expense':
      return { bg: G.dangerBg, color: G.danger, label: 'Expense' };
    default:
      return { bg: `${G.border}55`, color: G.muted, label: humanizeEnum(type) };
  }
}

export function BillingPanel({
  company,
  loads = [],
  adminUser,
  apiEnabled,
}: import('@/types/tabs').BillingPanelProps) {
  const [section, setSection] = useState<'invoices' | 'bills' | 'payments' | 'coa'>(
    'invoices',
  );
  const [loading, setLoading] = useState(Boolean(apiEnabled));
  const [invoices, setInvoices] = useState<
    import('@/types/dtos').InvoiceDto[]
  >([]);
  const [bills, setBills] = useState<import('@/types/dtos').BillDto[]>([]);
  const [payments, setPayments] = useState<
    import('@/types/dtos').PaymentDto[]
  >([]);
  const [accounts, setAccounts] = useState<
    import('@/types/dtos').AccountDto[]
  >([]);
  const [customers, setCustomers] = useState<
    import('@/types/dtos').MdmRecord[]
  >([]);
  const [brokers, setBrokers] = useState<import('@/types/dtos').MdmRecord[]>(
    [],
  );
  const [inv, setInv] = useState({
    customerName: '',
    customerId: '',
    brokerId: '',
    brokerName: '',
    loadId: '',
    issueDate: '',
    dueDate: '',
    amount: '',
    tax: '0',
  });
  const [bill, setBill] = useState({
    vendorName: '',
    issueDate: '',
    dueDate: '',
    amount: '',
  });
  const [pay, setPay] = useState({
    direction: 'customer',
    partyName: '',
    invoiceId: '',
    billId: '',
    amount: '',
    paidAt: '',
    method: 'ach',
  });

  const loadAll = async () => {
    if (!apiEnabled || !company?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [i, b, p, a, c, br] = await Promise.all([
        invoicesApi.list(company.id),
        billsApi.list(company.id),
        paymentsApi.list(company.id),
        accountsApi.list(company.id),
        companiesApi.customers(company.id, true).catch(() => []),
        companiesApi.brokers(company.id, true).catch(() => []),
      ]);
      setInvoices(i);
      setBills(b);
      setPayments(p);
      setAccounts(a);
      setCustomers(Array.isArray(c) ? c : []);
      setBrokers(Array.isArray(br) ? br : []);
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Billing load failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, apiEnabled]);

  const createInvoice = async () => {
    if (
      blank(inv.customerName) ||
      blank(inv.issueDate) ||
      blank(inv.dueDate) ||
      blank(inv.amount)
    ) {
      notify('Customer, dates, and amount required', 'error');
      return;
    }
    const load = loads.find((l) => l.id === inv.loadId);
    try {
      await invoicesApi.create({
        companyId: company.id,
        customerName: inv.customerName,
        customerId: inv.customerId || null,
        brokerId: inv.brokerId || null,
        brokerName: inv.brokerName || '',
        loadId: inv.loadId || null,
        tripNo: load?.tripNo || '',
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        tax: Number(inv.tax || 0),
        status: 'sent',
        lines: [{ description: 'Freight', amount: Number(inv.amount) }],
      });
      await auditApi.create({
        companyId: company.id,
        actorId: adminUser?.id,
        actorName: adminUser?.name,
        action: 'invoice.create',
        entityType: 'invoice',
        entityId: inv.loadId || '',
      });
      notify('Invoice created');
      await loadAll();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Invoice failed'), 'error');
    }
  };

  const createBill = async () => {
    if (
      blank(bill.vendorName) ||
      blank(bill.issueDate) ||
      blank(bill.dueDate) ||
      blank(bill.amount)
    ) {
      notify('Vendor, dates, and amount required', 'error');
      return;
    }
    try {
      await billsApi.create({
        companyId: company.id,
        vendorName: bill.vendorName,
        issueDate: bill.issueDate,
        dueDate: bill.dueDate,
        total: Number(bill.amount),
        lines: [{ description: 'Vendor bill', amount: Number(bill.amount) }],
      });
      notify('Bill created');
      await loadAll();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Bill failed'), 'error');
    }
  };

  const createPayment = async () => {
    if (blank(pay.partyName) || blank(pay.amount) || blank(pay.paidAt)) {
      notify('Party, amount, and paid date required', 'error');
      return;
    }
    try {
      await paymentsApi.create({
        companyId: company.id,
        direction: pay.direction,
        partyName: pay.partyName,
        invoiceId: pay.direction === 'customer' ? pay.invoiceId || null : null,
        billId: pay.direction === 'vendor' ? pay.billId || null : null,
        amount: Number(pay.amount),
        paidAt: pay.paidAt,
        method: pay.method,
      });
      notify('Payment recorded');
      await loadAll();
    } catch (e: unknown) {
      notify(getApiErrorMessage(e, 'Payment failed'), 'error');
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <SectionTitle>Billing & AP/AR</SectionTitle>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['invoices', 'bills', 'payments', 'coa'] as const).map((s) => (
          <Btn
            key={s}
            size="sm"
            variant={section === s ? 'primary' : 'outline'}
            onClick={() => setSection(s)}
          >
            {humanizeEnum(s)}
          </Btn>
        ))}
      </div>

      {section === 'invoices' && (
        <Card>
          <Sel
            label="Customer (master)"
            value={inv.customerId}
            onChange={(e) => {
              const id = e.target.value;
              const c = customers.find((x) => x.id === id);
              setInv({
                ...inv,
                customerId: id,
                customerName: c?.name || inv.customerName,
              });
            }}
          >
            <option value="">— Or type name below —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Sel>
          <Sel
            label="Broker (master)"
            value={inv.brokerId}
            onChange={(e) => {
              const id = e.target.value;
              const b = brokers.find((x) => x.id === id);
              setInv({
                ...inv,
                brokerId: id,
                brokerName: b?.name || '',
              });
            }}
          >
            <option value="">— Optional —</option>
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Sel>
          <Inp
            label="Customer name"
            value={inv.customerName}
            onChange={(e) => setInv({ ...inv, customerName: e.target.value })}
          />
          <Sel
            label="Load (optional)"
            value={inv.loadId}
            onChange={(e) => setInv({ ...inv, loadId: e.target.value })}
          >
            <option value="">—</option>
            {loads.map((l) => (
              <option key={l.id} value={l.id}>
                {formatLoadLabel(l)}
              </option>
            ))}
          </Sel>
          <Inp
            label="Issue date"
            value={inv.issueDate}
            onChange={(e) => setInv({ ...inv, issueDate: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Inp
            label="Due date"
            value={inv.dueDate}
            onChange={(e) => setInv({ ...inv, dueDate: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Inp
            label="Amount"
            value={inv.amount}
            onChange={(e) => setInv({ ...inv, amount: e.target.value })}
          />
          <Btn onClick={() => void createInvoice()}>Create invoice</Btn>
          {loading ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: G.muted, fontSize: 12, marginBottom: 8 }}>
                Loading invoices…
              </div>
              <Skeleton rows={3} height={38} />
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ marginTop: 12, color: G.muted, fontSize: 12 }}>
              No invoices yet.
            </div>
          ) : null}
          {!loading && invoices.map((i) => (
            <div key={i.id} style={{ padding: '8px 0', fontSize: 13, borderTop: `1px solid ${G.border}` }}>
              {i.customerName} · ${Number(i.total ?? 0).toFixed(2)} · <Pill>{humanizeEnum(i.status)}</Pill> ·
              paid ${Number(i.amountPaid ?? 0).toFixed(2)} · due {i.dueDate}
            </div>
          ))}
        </Card>
      )}

      {section === 'bills' && (
        <Card>
          <Inp
            label="Vendor"
            value={bill.vendorName}
            onChange={(e) => setBill({ ...bill, vendorName: e.target.value })}
          />
          <Inp
            label="Issue"
            value={bill.issueDate}
            onChange={(e) => setBill({ ...bill, issueDate: e.target.value })}
          />
          <Inp
            label="Due"
            value={bill.dueDate}
            onChange={(e) => setBill({ ...bill, dueDate: e.target.value })}
          />
          <Inp
            label="Amount"
            value={bill.amount}
            onChange={(e) => setBill({ ...bill, amount: e.target.value })}
          />
          <Btn onClick={() => void createBill()}>Create bill</Btn>
          {loading ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: G.muted, fontSize: 12, marginBottom: 8 }}>
                Loading bills…
              </div>
              <Skeleton rows={3} height={38} />
            </div>
          ) : bills.length === 0 ? (
            <div style={{ marginTop: 12, color: G.muted, fontSize: 12 }}>
              No bills yet.
            </div>
          ) : null}
          {!loading && bills.map((b) => (
            <div key={b.id} style={{ padding: '8px 0', fontSize: 13 }}>
              {b.vendorName} · ${Number(b.total ?? 0).toFixed(2)} · {humanizeEnum(b.status)}
            </div>
          ))}
        </Card>
      )}

      {section === 'payments' && (
        <Card>
          <Sel
            label="Direction"
            value={pay.direction}
            onChange={(e) => setPay({ ...pay, direction: e.target.value })}
          >
            <option value="customer">Customer payment</option>
            <option value="vendor">Vendor payment</option>
          </Sel>
          <Inp
            label="Party"
            value={pay.partyName}
            onChange={(e) => setPay({ ...pay, partyName: e.target.value })}
          />
          {pay.direction === 'customer' && (
            <Sel
              label="Invoice"
              value={pay.invoiceId}
              onChange={(e) => setPay({ ...pay, invoiceId: e.target.value })}
            >
              <option value="">—</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.customerName} ${i.total}
                </option>
              ))}
            </Sel>
          )}
          {pay.direction === 'vendor' && (
            <Sel
              label="Bill"
              value={pay.billId}
              onChange={(e) => setPay({ ...pay, billId: e.target.value })}
            >
              <option value="">—</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.vendorName} ${b.total}
                </option>
              ))}
            </Sel>
          )}
          <Inp
            label="Amount"
            value={pay.amount}
            onChange={(e) => setPay({ ...pay, amount: e.target.value })}
          />
          <Inp
            label="Paid at"
            value={pay.paidAt}
            onChange={(e) => setPay({ ...pay, paidAt: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Btn onClick={() => void createPayment()}>Record payment</Btn>
          {loading ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ color: G.muted, fontSize: 12, marginBottom: 8 }}>
                Loading payments…
              </div>
              <Skeleton rows={3} height={38} />
            </div>
          ) : payments.length === 0 ? (
            <div style={{ marginTop: 12, color: G.muted, fontSize: 12 }}>
              No payments recorded yet.
            </div>
          ) : null}
          {!loading && payments.map((p) => (
            <div key={p.id} style={{ padding: '8px 0', fontSize: 13 }}>
              {humanizeEnum(p.direction, {
                customer: 'Customer payment',
                vendor: 'Vendor payment',
              })} · {p.partyName} · ${p.amount.toFixed(2)} · {humanizeEnum(p.method)} · {p.paidAt}
            </div>
          ))}
        </Card>
      )}

      {section === 'coa' && (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {/* Header Bar */}
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: `1px solid ${G.border}`,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: G.text }}>
                  Chart of Accounts
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: RADIUS.pill,
                    background: `${G.gold}18`,
                    color: G.gold,
                    border: `1px solid ${G.gold}33`,
                  }}
                >
                  {loading
                    ? 'Loading…'
                    : `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}`}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: G.muted }}>
                Standard general ledger codes for journal entries, settlements, and expense tracking.
              </p>
            </div>

            <Btn
              size="sm"
              variant={accounts.length > 0 ? 'outline' : 'primary'}
              onClick={async () => {
                if (!company?.id) {
                  notify('Company identifier is missing', 'error');
                  return;
                }
                try {
                  await accountsApi.seedDefaults(company.id);
                  notify('Default chart of accounts seeded');
                  await loadAll();
                } catch (e: unknown) {
                  notify(getApiErrorMessage(e, 'Seed failed'), 'error');
                }
              }}
            >
              Seed Default Accounts
            </Btn>
          </div>

          {/* Table or Empty State */}
          {loading ? (
            <div style={{ padding: '16px 20px' }}>
              <div style={{ color: G.muted, fontSize: 12, marginBottom: 10 }}>
                Loading chart of accounts…
              </div>
              <Skeleton rows={5} height={34} />
            </div>
          ) : accounts.length === 0 ? (
            <div
              style={{
                padding: '48px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: RADIUS.md,
                  background: G.card2,
                  border: `1px solid ${G.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  color: G.muted,
                }}
              >
                📊
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: G.text }}>
                  No accounts configured yet
                </div>
                <div style={{ fontSize: 12, color: G.muted, marginTop: 4 }}>
                  Click &quot;Seed default accounts&quot; to populate standard assets, liabilities, revenues, and expenses.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: G.card2, borderBottom: `1px solid ${G.border}` }}>
                    <th
                      style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.muted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        width: 140,
                      }}
                    >
                      Account Code
                    </th>
                    <th
                      style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.muted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Account Name
                    </th>
                    <th
                      style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.muted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        width: 160,
                      }}
                    >
                      Account Type
                    </th>
                    <th
                      style={{
                        padding: '10px 20px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: G.muted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        width: 120,
                        textAlign: 'right',
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, idx) => {
                    const badge = getAccountTypeBadge(a.type);
                    return (
                      <tr
                        key={a.id || a.code || idx}
                        style={{
                          borderBottom:
                            idx === accounts.length - 1 ? 'none' : `1px solid ${G.border}33`,
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: 12,
                              fontWeight: 700,
                              color: G.gold,
                              background: `${G.gold}12`,
                              border: `1px solid ${G.gold}2b`,
                              padding: '3px 8px',
                              borderRadius: RADIUS.sm,
                              letterSpacing: 0.5,
                              display: 'inline-block',
                            }}
                          >
                            {a.code}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>
                            {a.name}
                          </div>
                        </td>
                        <td style={{ padding: '12px 20px', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 10px',
                              borderRadius: RADIUS.pill,
                              background: badge.bg,
                              color: badge.color,
                              fontSize: 11,
                              fontWeight: 600,
                              border: `1px solid ${badge.color}33`,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: badge.color,
                              }}
                            />
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 12,
                              fontWeight: 500,
                              color: a.active !== false ? G.success : G.muted,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: a.active !== false ? G.success : G.muted,
                              }}
                            />
                            {a.active !== false ? 'Active' : 'Archived'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
