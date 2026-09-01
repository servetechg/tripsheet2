import { useEffect, useState } from 'react';
import { G } from '@/lib/theme';
import { Btn, Card, Inp, Sel, SectionTitle, Pill } from '@/components/ui';
import { notify } from '@/components/feedback/Toast';
import { blank } from '@/lib/format';
import {
  invoicesApi,
  billsApi,
  paymentsApi,
  accountsApi,
  auditApi,
  companiesApi,
} from '@/lib/api';

export function BillingPanel({
  company,
  loads = [],
  adminUser,
  apiEnabled,
}: any) {
  const [section, setSection] = useState<'invoices' | 'bills' | 'payments' | 'coa'>(
    'invoices',
  );
  const [invoices, setInvoices] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
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
    if (!apiEnabled) return;
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
    } catch (e: any) {
      notify(e?.message || 'Billing load failed', 'error');
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, apiEnabled]);

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
    const load = loads.find((l: any) => l.id === inv.loadId);
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
    } catch (e: any) {
      notify(e?.message || 'Invoice failed', 'error');
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
    } catch (e: any) {
      notify(e?.message || 'Bill failed', 'error');
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
    } catch (e: any) {
      notify(e?.message || 'Payment failed', 'error');
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
            {s}
          </Btn>
        ))}
      </div>

      {section === 'invoices' && (
        <Card>
          <Sel
            label="Customer (master)"
            value={inv.customerId}
            onChange={(e: any) => {
              const id = e.target.value;
              const c = customers.find((x: any) => x.id === id);
              setInv({
                ...inv,
                customerId: id,
                customerName: c?.name || inv.customerName,
              });
            }}
          >
            <option value="">— Or type name below —</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Sel>
          <Sel
            label="Broker (master)"
            value={inv.brokerId}
            onChange={(e: any) => {
              const id = e.target.value;
              const b = brokers.find((x: any) => x.id === id);
              setInv({
                ...inv,
                brokerId: id,
                brokerName: b?.name || '',
              });
            }}
          >
            <option value="">— Optional —</option>
            {brokers.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Sel>
          <Inp
            label="Customer name"
            value={inv.customerName}
            onChange={(e: any) => setInv({ ...inv, customerName: e.target.value })}
          />
          <Sel
            label="Load (optional)"
            value={inv.loadId}
            onChange={(e: any) => setInv({ ...inv, loadId: e.target.value })}
          >
            <option value="">—</option>
            {loads.map((l: any) => (
              <option key={l.id} value={l.id}>
                {l.tripNo || l.id.slice(0, 6)} {l.origin}→{l.destination}
              </option>
            ))}
          </Sel>
          <Inp
            label="Issue date"
            value={inv.issueDate}
            onChange={(e: any) => setInv({ ...inv, issueDate: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Inp
            label="Due date"
            value={inv.dueDate}
            onChange={(e: any) => setInv({ ...inv, dueDate: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Inp
            label="Amount"
            value={inv.amount}
            onChange={(e: any) => setInv({ ...inv, amount: e.target.value })}
          />
          <Btn onClick={() => void createInvoice()}>Create invoice</Btn>
          {invoices.map((i) => (
            <div key={i.id} style={{ padding: '8px 0', fontSize: 13, borderTop: `1px solid ${G.border}` }}>
              {i.customerName} · ${i.total.toFixed(2)} · <Pill>{i.status}</Pill> ·
              paid ${i.amountPaid.toFixed(2)} · due {i.dueDate}
            </div>
          ))}
        </Card>
      )}

      {section === 'bills' && (
        <Card>
          <Inp
            label="Vendor"
            value={bill.vendorName}
            onChange={(e: any) => setBill({ ...bill, vendorName: e.target.value })}
          />
          <Inp
            label="Issue"
            value={bill.issueDate}
            onChange={(e: any) => setBill({ ...bill, issueDate: e.target.value })}
          />
          <Inp
            label="Due"
            value={bill.dueDate}
            onChange={(e: any) => setBill({ ...bill, dueDate: e.target.value })}
          />
          <Inp
            label="Amount"
            value={bill.amount}
            onChange={(e: any) => setBill({ ...bill, amount: e.target.value })}
          />
          <Btn onClick={() => void createBill()}>Create bill</Btn>
          {bills.map((b) => (
            <div key={b.id} style={{ padding: '8px 0', fontSize: 13 }}>
              {b.vendorName} · ${b.total.toFixed(2)} · {b.status}
            </div>
          ))}
        </Card>
      )}

      {section === 'payments' && (
        <Card>
          <Sel
            label="Direction"
            value={pay.direction}
            onChange={(e: any) => setPay({ ...pay, direction: e.target.value })}
          >
            <option value="customer">Customer payment</option>
            <option value="vendor">Vendor payment</option>
          </Sel>
          <Inp
            label="Party"
            value={pay.partyName}
            onChange={(e: any) => setPay({ ...pay, partyName: e.target.value })}
          />
          {pay.direction === 'customer' && (
            <Sel
              label="Invoice"
              value={pay.invoiceId}
              onChange={(e: any) => setPay({ ...pay, invoiceId: e.target.value })}
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
              onChange={(e: any) => setPay({ ...pay, billId: e.target.value })}
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
            onChange={(e: any) => setPay({ ...pay, amount: e.target.value })}
          />
          <Inp
            label="Paid at"
            value={pay.paidAt}
            onChange={(e: any) => setPay({ ...pay, paidAt: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Btn onClick={() => void createPayment()}>Record payment</Btn>
          {payments.map((p) => (
            <div key={p.id} style={{ padding: '8px 0', fontSize: 13 }}>
              {p.direction} · {p.partyName} · ${p.amount.toFixed(2)} · {p.paidAt}
            </div>
          ))}
        </Card>
      )}

      {section === 'coa' && (
        <Card>
          <Btn
            onClick={async () => {
              try {
                await accountsApi.seedDefaults(company.id);
                notify('Default chart of accounts seeded');
                await loadAll();
              } catch (e: any) {
                notify(e?.message || 'Seed failed', 'error');
              }
            }}
          >
            Seed default accounts
          </Btn>
          {accounts.map((a) => (
            <div key={a.id} style={{ fontSize: 13, padding: '6px 0' }}>
              {a.code} · {a.name} · {a.type}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
