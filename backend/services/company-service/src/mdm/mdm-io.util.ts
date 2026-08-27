/**
 * Chapter 5 MDM Phase 7 — CSV import/export column maps + row validation.
 */

import {
  LOCATION_STATUSES,
  PARTY_STATUSES,
  buildLocationNormalizedKey,
  buildPartyNormalizedKey,
  normalizeKeyPart,
} from './party-status';
import { buildCommodityNormalizedKey } from './catalog.util';

export const MDM_IO_ENTITIES = [
  'brokers',
  'customers',
  'locations',
  'commodities',
] as const;
export type MdmIoEntity = (typeof MDM_IO_ENTITIES)[number];

export function isMdmIoEntity(v: string): v is MdmIoEntity {
  return (MDM_IO_ENTITIES as readonly string[]).includes(v);
}

export const MDM_IO_COLUMNS: Record<MdmIoEntity, string[]> = {
  brokers: [
    'name',
    'mc',
    'dot',
    'scac',
    'phone',
    'email',
    'website',
    'paymentTerms',
    'rateConfEmail',
    'status',
    'notes',
  ],
  customers: [
    'name',
    'legalName',
    'dba',
    'phone',
    'email',
    'website',
    'paymentTerms',
    'creditLimit',
    'currency',
    'taxExempt',
    'status',
    'notes',
  ],
  locations: [
    'name',
    'line1',
    'line2',
    'city',
    'region',
    'postal',
    'country',
    'timeZone',
    'status',
  ],
  commodities: [
    'name',
    'nmfc',
    'hazmat',
    'tempMin',
    'tempMax',
    'weightLimit',
    'status',
    'notes',
  ],
};

export type CsvRowError = {
  row: number;
  field: string;
  message: string;
};

export type ValidatedIoRow = {
  row: number;
  body: Record<string, unknown>;
  key: string;
  name: string;
};

function parseBool(v: string): boolean {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function parseNum(v: string): number | null {
  if (!String(v || '').trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function validateIoRow(
  entity: MdmIoEntity,
  raw: Record<string, string>,
  row: number,
): { ok?: ValidatedIoRow; errors: CsvRowError[] } {
  const errors: CsvRowError[] = [];
  const get = (k: string) => String(raw[k] ?? '').trim();

  if (entity === 'brokers' || entity === 'customers') {
    const name = get('name');
    if (!name) errors.push({ row, field: 'name', message: 'Name is required' });
    const status = get('status') || 'active';
    if (!(PARTY_STATUSES as readonly string[]).includes(status.toLowerCase())) {
      errors.push({
        row,
        field: 'status',
        message: `Invalid status "${status}"`,
      });
    }
    if (entity === 'customers' && get('creditLimit')) {
      const n = parseNum(get('creditLimit'));
      if (n == null || Number.isNaN(n)) {
        errors.push({
          row,
          field: 'creditLimit',
          message: 'creditLimit must be a number',
        });
      }
    }
    if (errors.length) return { errors };
    const body: Record<string, unknown> =
      entity === 'brokers'
        ? {
            name,
            mc: get('mc'),
            dot: get('dot'),
            scac: get('scac'),
            phone: get('phone'),
            email: get('email'),
            website: get('website'),
            paymentTerms: get('paymentTerms'),
            rateConfEmail: get('rateConfEmail'),
            status: status.toLowerCase(),
            notes: get('notes'),
          }
        : {
            name,
            legalName: get('legalName'),
            dba: get('dba'),
            phone: get('phone'),
            email: get('email'),
            website: get('website'),
            paymentTerms: get('paymentTerms'),
            creditLimit: get('creditLimit')
              ? parseNum(get('creditLimit'))
              : null,
            currency: get('currency') || 'CAD',
            taxExempt: parseBool(get('taxExempt')),
            status: status.toLowerCase(),
            notes: get('notes'),
          };
    return {
      errors: [],
      ok: {
        row,
        body,
        name,
        key: buildPartyNormalizedKey({
          name,
          mc: get('mc'),
          dot: get('dot'),
          phone: get('phone'),
          email: get('email'),
        }),
      },
    };
  }

  if (entity === 'locations') {
    const name = get('name') || get('city') || 'Location';
    const line1 = get('line1');
    const city = get('city');
    if (!line1 && !city && !get('name')) {
      errors.push({
        row,
        field: 'name',
        message: 'Location needs a name, address, or city',
      });
    }
    const status = (get('status') || 'active').toLowerCase();
    if (!(LOCATION_STATUSES as readonly string[]).includes(status) && status !== 'active') {
      errors.push({
        row,
        field: 'status',
        message: `Invalid status "${status}"`,
      });
    }
    if (errors.length) return { errors };
    const body = {
      name,
      line1,
      line2: get('line2'),
      city,
      region: get('region'),
      postal: get('postal'),
      country: get('country') || 'CA',
      timeZone: get('timeZone'),
      status: status === 'inactive' || status === 'archived' ? 'inactive' : 'active',
    };
    return {
      errors: [],
      ok: {
        row,
        body,
        name,
        key: buildLocationNormalizedKey(body),
      },
    };
  }

  const name = get('name');
  if (!name) errors.push({ row, field: 'name', message: 'Name is required' });
  const status = (get('status') || 'active').toLowerCase();
  if (status !== 'active' && status !== 'inactive') {
    errors.push({ row, field: 'status', message: `Invalid status "${status}"` });
  }
  for (const f of ['tempMin', 'tempMax', 'weightLimit'] as const) {
    if (get(f)) {
      const n = parseNum(get(f));
      if (n == null || Number.isNaN(n)) {
        errors.push({ row, field: f, message: `${f} must be a number` });
      }
    }
  }
  if (errors.length) return { errors };
  const body = {
    name,
    nmfc: get('nmfc'),
    hazmat: parseBool(get('hazmat')),
    tempMin: get('tempMin') ? parseNum(get('tempMin')) : null,
    tempMax: get('tempMax') ? parseNum(get('tempMax')) : null,
    weightLimit: get('weightLimit') ? parseNum(get('weightLimit')) : null,
    status,
    notes: get('notes'),
  };
  return {
    errors: [],
    ok: {
      row,
      body,
      name,
      key: buildCommodityNormalizedKey(name) || normalizeKeyPart(name),
    },
  };
}

export function filenameForEntity(entity: MdmIoEntity): string {
  const day = new Date().toISOString().slice(0, 10);
  return `mdm-${entity}-${day}.csv`;
}
