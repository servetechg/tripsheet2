/** Convert stored value → `<input type="datetime-local">` value (local). */
export function toDatetimeLocal(value: string | null | undefined): string {
  if (!value || !String(value).trim()) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Store datetime-local as ISO for consistent ETA/OTP comparisons. */
export function datetimeLocalToIso(value: string): string {
  if (!value?.trim()) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.trim();
  return d.toISOString();
}

export function formatDisplayDateTime(value: string | null | undefined): string {
  if (!value || !String(value).trim()) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Money / decimal: allow digits + optional one decimal (max `decimals` places). */
export function sanitizeDecimal(raw: string, decimals = 2): string {
  let v = raw.replace(/[^\d.]/g, '');
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    v =
      v.slice(0, firstDot + 1) +
      v.slice(firstDot + 1).replace(/\./g, '');
  }
  if (decimals >= 0 && firstDot !== -1) {
    const [whole, frac = ''] = v.split('.');
    v = `${whole}.${frac.slice(0, decimals)}`;
  }
  if (v.startsWith('.')) v = `0${v}`;
  return v;
}

/** Non-negative integer (miles, trip no digits portion). */
export function sanitizeInteger(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function parseNonNegNumber(v: string): number | null {
  if (!v.trim()) return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function isValidTripNo(v: string): boolean {
  if (!v.trim()) return true;
  return /^[A-Za-z0-9][A-Za-z0-9\-_/]{0,31}$/.test(v.trim());
}
