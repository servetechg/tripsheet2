import type { Load } from '@tripsheet/shared';

export const blank = (v: unknown): boolean => !v || !String(v).trim();

/** Extract a user-facing message from API / fetch errors. */
export function getApiErrorMessage(
  e: unknown,
  fallback = 'Request failed',
): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const rec = e as Record<string, unknown>;
    const body =
      rec.body && typeof rec.body === 'object'
        ? (rec.body as Record<string, unknown>)
        : undefined;
    const raw = rec.message ?? body?.message;
    if (Array.isArray(raw)) return raw.map(String).join(', ');
    if (typeof raw === 'string' && raw.trim()) return raw;
  }
  return fallback;
}

export const fmt = (n: unknown, c = 'CAD'): string =>
  `${c} ${parseFloat(String(n ?? 0)).toFixed(2)}`;

export const humanizeEnum = (
  value: unknown,
  labels: Record<string, string> = {},
): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  if (labels[raw]) return labels[raw];
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatLoadLabel = (load: Pick<Load, 'origin' | 'destination' | 'tripNo'>): string => {
  const route = [load?.origin, load?.destination]
    .filter((value) => String(value ?? '').trim())
    .join(' → ');
  const trip = load?.tripNo ? `Trip #${load.tripNo}` : 'Unnumbered load';
  return route ? `${trip} · ${route}` : trip;
};

export const isCompactIdentifier = (
  value: unknown,
  maxLength = 14,
): boolean => {
  const text = String(value ?? '').trim();
  return Boolean(text) && text.length <= maxLength && !/\s/.test(text);
};
