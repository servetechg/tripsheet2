/**
 * Chapter 5 MDM Phase 2 — party/location status + duplicate helpers.
 */

export const PARTY_STATUSES = [
  'active',
  'inactive',
  'suspended',
  'blacklisted',
  'watch',
] as const;
export type PartyStatus = (typeof PARTY_STATUSES)[number];

export const LOCATION_STATUSES = ['active', 'inactive', 'archived'] as const;

export function normalizePartyStatus(
  status: string | null | undefined,
  fallback: PartyStatus = 'active',
): PartyStatus {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  if ((PARTY_STATUSES as readonly string[]).includes(s)) {
    return s as PartyStatus;
  }
  return fallback;
}

/** Selectable for *new* dispatch / invoice work. */
export function canSelectPartyStatus(
  status: string | null | undefined,
): boolean {
  const s = normalizePartyStatus(status);
  return s === 'active' || s === 'watch';
}

export function partySelectBlockReason(
  kind: string,
  name: string,
  status: string | null | undefined,
): string {
  const s = normalizePartyStatus(status);
  const label = name || kind;
  switch (s) {
    case 'inactive':
      return `${kind} "${label}" is inactive and cannot be selected`;
    case 'suspended':
      return `${kind} "${label}" is suspended and cannot be selected`;
    case 'blacklisted':
      return `${kind} "${label}" is blacklisted and cannot be selected`;
    default:
      return `${kind} "${label}" status "${s}" cannot be selected`;
  }
}

export function normalizeKeyPart(v: string | null | undefined): string {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 80);
}

export function buildPartyNormalizedKey(input: {
  name?: string;
  mc?: string;
  dot?: string;
  phone?: string;
  email?: string;
}): string {
  const mc = normalizeKeyPart(input.mc);
  const dot = normalizeKeyPart(input.dot);
  const phone = normalizeKeyPart(input.phone);
  const email = normalizeKeyPart(input.email);
  const name = normalizeKeyPart(input.name);
  if (mc) return `mc:${mc}`;
  if (dot) return `dot:${dot}`;
  if (phone) return `ph:${phone}`;
  if (email) return `em:${email}`;
  return `nm:${name}`;
}

export function buildLocationNormalizedKey(input: {
  line1?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
}): string {
  return [
    normalizeKeyPart(input.country) || 'ca',
    normalizeKeyPart(input.region),
    normalizeKeyPart(input.city),
    normalizeKeyPart(input.postal),
    normalizeKeyPart(input.line1),
  ].join('|');
}

export function namesLikelyDuplicate(a: string, b: string): boolean {
  const na = normalizeKeyPart(a);
  const nb = normalizeKeyPart(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}
