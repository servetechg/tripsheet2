/** Strip to digits only (max 11 for NA +1). */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/**
 * Format as user types: (403) 555-0100 or +1 (403) 555-0100
 * Non-digit characters are ignored; length capped at 11 digits.
 */
export function formatPhoneInput(raw: string): string {
  let digits = phoneDigits(raw);
  if (!digits.length) return '';

  let prefix = '';
  if (digits.length === 11 && digits.startsWith('1')) {
    prefix = '+1 ';
    digits = digits.slice(1);
  } else if (raw.trimStart().startsWith('+') && digits.length > 10) {
    prefix = '+1 ';
    digits = digits.slice(-10);
  }

  const d = digits.slice(0, 10);
  if (d.length <= 3) return `${prefix}(${d}`;
  if (d.length <= 6) return `${prefix}(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `${prefix}(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const PHONE_INPUT_MAX_LENGTH = 17;
