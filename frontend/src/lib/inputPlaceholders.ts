import type { InputHTMLAttributes } from 'react';

/** Example placeholders keyed by normalized label text (UI hints only). */
const LABEL_HINTS: Record<string, string> = {
  name: 'John Doe',
  'full name': 'John Doe',
  'first name': 'John',
  'last name': 'Doe',
  email: 'john@example.com',
  'email address': 'john@example.com',
  company: 'Acme Inc.',
  'company name': 'Acme Inc.',
  website: 'https://example.com',
  url: 'https://example.com',
  address: '123 Main Street',
  street: '123 Main Street',
  city: 'New York',
  zip: '10001',
  'zip code': '10001',
  postal: '10001',
  'postal code': '10001',
  phone: '(555) 123-4567',
  'phone number': '(555) 123-4567',
  mobile: '(555) 123-4567',
  message: 'Write your message...',
  search: 'Search users, reports, settings...',
  password: 'Enter your password',
  'current password': 'Enter current password',
  'new password': 'Enter new password',
  'confirm password': 'Confirm your password',
};

export const PHONE_PLACEHOLDER = '(555) 123-4567';
export const SEARCH_PLACEHOLDER = 'Search users, reports, settings...';
export const PASSWORD_PLACEHOLDER = 'Enter your password';

export type InputType = InputHTMLAttributes<HTMLInputElement>['type'];

function normalizeLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const EXACT_TYPES: Record<string, InputType> = {
  email: 'email',
  'email address': 'email',
  password: 'password',
  phone: 'tel',
  'phone number': 'tel',
  mobile: 'tel',
  fax: 'tel',
  website: 'url',
  url: 'url',
  search: 'search',
};

/** Infer HTML input type from label text (UI only; explicit `type` prop wins). */
export function inputTypeFromLabel(label: unknown): InputType | undefined {
  if (typeof label !== 'string') return undefined;
  const key = normalizeLabel(label);

  if (EXACT_TYPES[key]) return EXACT_TYPES[key];

  if (
    key.includes('date of birth') ||
    key.includes('expiry date') ||
    key === 'eta date' ||
    key.includes('contract start date')
  ) {
    return 'date';
  }

  if (key.includes('eta time') || key.includes('time local')) {
    return 'time';
  }

  if (
    /\b(amount|weight|pieces|vacation pay|probation|notice period|lockout minutes|session days|failed attempts|wait time|detention|team rate|mileage|miles|qty|quantity)\b/.test(
      key,
    ) ||
    key.includes('rate')
  ) {
    return 'number';
  }

  if (key.includes('email')) return 'email';
  if (key.includes('password')) return 'password';
  if (key.includes('phone') || key.includes('mobile') || key.includes('fax')) {
    return 'tel';
  }
  if (key.includes('website') || key.includes(' url')) return 'url';
  if (key.includes('search')) return 'search';

  return undefined;
}

export function resolveInputType(
  type: InputType | undefined,
  label: unknown,
  phone?: boolean,
): InputType {
  if (type) return type;
  if (phone) return 'tel';
  return inputTypeFromLabel(label) ?? 'text';
}

export function placeholderFromLabel(label: unknown): string | undefined {
  if (typeof label !== 'string') return undefined;
  return LABEL_HINTS[normalizeLabel(label)];
}

/** Placeholder for password fields based on label (UI hint only). */
export function passwordPlaceholderFromLabel(label: unknown): string {
  if (typeof label !== 'string') return PASSWORD_PLACEHOLDER;
  const key = normalizeLabel(label);
  if (LABEL_HINTS[key]) return LABEL_HINTS[key];
  if (key.includes('confirm')) return 'Confirm your password';
  if (key.includes('current')) return 'Enter current password';
  if (key.includes('new')) return 'Enter new password';
  return PASSWORD_PLACEHOLDER;
}

export function resolveInputPlaceholder(
  placeholder: string | undefined,
  label: unknown,
  opts: { phone?: boolean; isPassword?: boolean },
): string | undefined {
  if (placeholder) return placeholder;
  if (opts.phone) return PHONE_PLACEHOLDER;
  if (opts.isPassword) return passwordPlaceholderFromLabel(label);
  return placeholderFromLabel(label);
}
