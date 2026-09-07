import type { InputHTMLAttributes } from 'react';

export const PHONE_PLACEHOLDER = '(555) 123-4567';
export const SEARCH_PLACEHOLDER = 'Search users, reports, settings...';
export const PASSWORD_PLACEHOLDER = 'Enter your password';
export const DATE_PLACEHOLDER = 'YYYY-MM-DD';
export const OPTIONAL_PLACEHOLDER = 'Optional';
export const AMOUNT_PLACEHOLDER = '0.00';

/** Example placeholders keyed by normalized label text (UI hints only). */
const LABEL_HINTS: Record<string, string> = {
  // People & contact
  name: 'John Doe',
  'full name': 'John Doe',
  'first name': 'John',
  'last name': 'Doe',
  'admin full name': 'John Smith',
  'company full name': 'e.g. MKX Transport Ltd.',
  'emergency contact name': 'John Doe',
  'driver name 1': 'John Smith',
  'driver name 2': 'Optional',
  'driver name 2 (co-driver)': 'Optional',
  email: 'john@example.com',
  'email address': 'john@example.com',
  'admin email': 'admin@company.com',
  company: 'Acme Inc.',
  'company name': 'Acme Inc.',
  website: 'https://example.com',
  url: 'https://example.com',
  address: '123 Main Street',
  'home address': '123 Main St, Calgary, AB',
  street: '123 Main Street',
  city: 'e.g. Calgary',
  zip: '10001',
  'zip code': '10001',
  postal: '10001',
  'postal code': '10001',
  phone: PHONE_PLACEHOLDER,
  'phone number': PHONE_PLACEHOLDER,
  mobile: PHONE_PLACEHOLDER,
  'emergency phone': PHONE_PLACEHOLDER,
  'emergency contact phone': PHONE_PLACEHOLDER,
  'sms invite to phone': PHONE_PLACEHOLDER,
  message: 'Write your message...',
  search: SEARCH_PLACEHOLDER,
  password: PASSWORD_PLACEHOLDER,
  'current password': 'Enter current password',
  'new password': 'Enter new password',
  'confirm password': 'Confirm your password',
  notes: 'Optional notes',
  remarks: 'Optional remarks',
  description: 'Enter details...',
  tagline: 'Your company tagline',
  'legal name': 'e.g. MKX Transport Ltd.',
  'short name': 'e.g. MKX',
  'short name (on trip sheet)': 'e.g. MKX',
  citizenship: 'e.g. Canadian',
  'authenticator or recovery code': '000000',

  // Assets & fleet
  'unit no': 'e.g. 32054',
  'unit no.': 'e.g. 32054',
  'truck unit no.': 'e.g. 32054',
  year: 'e.g. 2022',
  make: 'e.g. Freightliner',
  model: 'e.g. Cascadia',
  vin: 'e.g. 1FUJGHDV8CLBP1234',
  'plate no': 'e.g. ABC-1234',
  'plate no.': 'e.g. ABC-1234',
  'trailer no.': 'e.g. DV1767',
  'trip no.': 'e.g. 34320',
  'trip no': 'e.g. 34320',
  'employee #': 'e.g. EMP-001',
  'license no.': 'e.g. AB-123456',
  "driver's license no.": 'e.g. AB-123456',
  'fast card #': 'Optional',
  'fast card # (if you have one)': 'Optional',

  // Dates
  'date of birth': DATE_PLACEHOLDER,
  'hire date': DATE_PLACEHOLDER,
  'effective date': DATE_PLACEHOLDER,
  'contract start date': DATE_PLACEHOLDER,
  'insurance expiry': DATE_PLACEHOLDER,
  'plate expiry': DATE_PLACEHOLDER,
  'permit expiry': DATE_PLACEHOLDER,
  'period start': DATE_PLACEHOLDER,
  'period end': DATE_PLACEHOLDER,
  'issue date': DATE_PLACEHOLDER,
  issue: DATE_PLACEHOLDER,
  due: DATE_PLACEHOLDER,
  'due date': DATE_PLACEHOLDER,
  performed: DATE_PLACEHOLDER,
  'next due': DATE_PLACEHOLDER,
  'inspected at': DATE_PLACEHOLDER,
  'paid at': DATE_PLACEHOLDER,
  completed: DATE_PLACEHOLDER,
  'expiry (optional)': DATE_PLACEHOLDER,
  date: DATE_PLACEHOLDER,
  'start date': 'e.g. 4 May 2026',
  'end date': 'e.g. 12 May 2026',
  'pickup date': 'e.g. 4 May',
  'drop date': 'e.g. 7 May',
  'eta date': 'e.g. 2026-06-15',
  'eta time (local)': 'e.g. 14:30',

  // Locations & routing
  origin: 'e.g. Calgary, AB',
  destination: 'e.g. Toronto, ON',
  from: 'e.g. Calgary, AB',
  to: 'e.g. Toronto, ON',
  location: 'e.g. Calgary, AB',
  commodity: 'e.g. General freight',
  'commodity description': 'e.g. Auto parts, dry goods',

  // Money & numbers
  amount: AMOUNT_PLACEHOLDER,
  cost: 'e.g. 250.00',
  miles: 'e.g. 1200',
  weight: 'e.g. 1500',
  'no. of pieces': 'e.g. 24',
  'customer rate ($)': AMOUNT_PLACEHOLDER,
  'carrier cost ($)': AMOUNT_PLACEHOLDER,
  'fuel surcharge ($)': AMOUNT_PLACEHOLDER,
  'accessorials ($)': AMOUNT_PLACEHOLDER,
  'detention hours': '0',
  'detention rate ($/hr)': AMOUNT_PLACEHOLDER,
  'team rate': 'e.g. 0.50/km',
  'wait time ($/hr)': 'e.g. 20',
  'fuel surcharge': 'e.g. 0.10/km',
  'vacation pay %': '4',
  'probation (days)': '90',
  'notice period (days)': '14',
  benefits: 'e.g. Health after 3 months',
  deductions: 'e.g. EI, CPP, Income Tax',
  'receipt #': 'e.g. R-001',

  // Company / master data
  code: 'e.g. LOC-01',
  kind: 'expense_category',
  brand: 'e.g. Volvo',
  'mc #': 'e.g. 123456',
  nmfc: 'e.g. 12345',
  hazmat: 'e.g. UN1203',
  hours: 'e.g. 6 AM – 6 PM',
  docks: 'e.g. 12',
  'safety rating': 'e.g. Satisfactory',
  vendor: 'e.g. Quick Lube',
  'customer name': 'e.g. Acme Corp',
  party: 'e.g. Customer name',
  title: 'e.g. Oil change',
  course: 'e.g. Defensive driving',
  currency: 'e.g. CAD',
  'time zone': 'e.g. America/Edmonton',
  'distance unit': 'e.g. mi',
  'logo url': 'https://example.com/logo.png',
  'file url': 'https://example.com/file.pdf',
  'accent color': 'e.g. #3D8CFF',
  'primary color': 'e.g. #3D8CFF',
  'secondary color': 'e.g. #64748B',
  'invoice header': 'Company name and address',
  'invoice footer': 'Payment terms, thank you note…',
  'key name': 'e.g. production-api',
  'min password length': '8',
  'password history (0 = off)': '0',
  'session days': '30',
  'idle timeout (minutes, 0 = off)': '30',
  'invite link ttl (days)': '7',
  'lockout after failures': '5',
  'lockout minutes': '15',

  // Compliance / manifest
  'cbsa carrier code (4 chars)': 'e.g. MKX1',
  'scac code (us, 4 chars)': 'e.g. MKXT',
  'dot number': 'e.g. 12345678',
  'csn (carrier security number)': 'Optional',
  'conveyance reference no. (crn)': 'e.g. MKX1XXXXX',
  'seal no. (if sealed)': 'Optional',
  'passport / pr / fast card #': 'Doc number',
  'shipper name': 'Company name',
  'shipper address': 'Street address',
  'shipper city / state': 'e.g. Detroit, MI',
  'consignee name': 'Company name',
  'consignee address': 'Street address',
  'consignee city / province': 'e.g. Calgary, AB',
};

/** Fallback placeholders when exact label key is missing. */
const LABEL_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bvin\b/, 'e.g. 1FUJGHDV8CLBP1234'],
  [/\bunit no\b|\btruck unit\b|\btrailer no\b/, 'e.g. 32054'],
  [/\btrip no\b/, 'e.g. 34320'],
  [/\bplate\b/, 'e.g. ABC-1234'],
  [/\bmake\b/, 'e.g. Freightliner'],
  [/\bmodel\b/, 'e.g. Cascadia'],
  [/\byear\b/, 'e.g. 2022'],
  [/\bemployee\b.*#/, 'e.g. EMP-001'],
  [/\blicense\b|\blicence\b/, 'e.g. AB-123456'],
  [/\bfast card\b/, 'Optional'],
  [/\bexpiry\b|\bexpire\b|\bexpired\b/, DATE_PLACEHOLDER],
  [/\bdue date\b|\bissue date\b|\bissue\b|\bdue\b|\bhire date\b|\bperformed\b|\binspected\b|\bpaid at\b|\bcompleted\b|\bperiod (start|end)\b/, DATE_PLACEHOLDER],
  [/\bdate of birth\b|\bdob\b/, DATE_PLACEHOLDER],
  [/\bpickup date\b|\bdrop date\b|\bstart date\b|\bend date\b|\beffective date\b|\bcontract start\b/, DATE_PLACEHOLDER],
  [/\bdate & time\b|\bdate and time\b|\bpickup date & time\b/, 'Select date and time'],
  [/\beta time\b/, 'e.g. 14:30'],
  [/\borigin\b|\bdestination\b|\bfrom\b|\bto\b|\blocation\b|\bcity\b/, 'e.g. Calgary, AB'],
  [/\bcommodity\b/, 'e.g. General freight'],
  [/\bnotes\b|\bremarks\b/, 'Optional notes'],
  [/\bdescription\b/, 'Enter details...'],
  [/\baddress\b|\bstreet\b/, '123 Main Street'],
  [/\bphone\b|\bmobile\b|\bfax\b|\bsms\b/, PHONE_PLACEHOLDER],
  [/\bemail\b/, 'john@example.com'],
  [/\bpassword\b/, PASSWORD_PLACEHOLDER],
  [/\bsearch\b/, SEARCH_PLACEHOLDER],
  [/\bamount\b|\bcost\b|\brate\b|\bprice\b/, AMOUNT_PLACEHOLDER],
  [/\bmiles\b|\bmileage\b/, 'e.g. 1200'],
  [/\bweight\b/, 'e.g. 1500'],
  [/\bpieces\b|\bqty\b|\bquantity\b/, 'e.g. 24'],
  [/\bvendor\b|\bcustomer\b|\bbroker\b|\bparty\b|\bshipper\b|\bconsignee\b/, 'Company name'],
  [/\bmc #\b|\bdot\b|\bscac\b|\bcbsa\b|\bcsn\b|\bnmfc\b/, 'e.g. 123456'],
  [/\bcode\b/, 'e.g. LOC-01'],
  [/\btagline\b/, 'Your company tagline'],
  [/\bname\b/, 'John Doe'],
  [/\burl\b|\bwebsite\b|\blogo\b|\bfile url\b/, 'https://example.com'],
  [/\bcurrency\b/, 'e.g. CAD'],
  [/\btime zone\b/, 'e.g. America/Edmonton'],
  [/\btitle\b/, 'e.g. Oil change'],
  [/\bcourse\b/, 'e.g. Defensive driving'],
  [/\brecovery code\b|\bauthenticator\b|\bmfa\b|\botp\b/, '000000'],
];

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
  'admin email': 'email',
  password: 'password',
  phone: 'tel',
  'phone number': 'tel',
  mobile: 'tel',
  fax: 'tel',
  website: 'url',
  url: 'url',
  search: 'search',
};

function placeholderFromPatterns(key: string): string | undefined {
  for (const [re, hint] of LABEL_PATTERNS) {
    if (re.test(key)) return hint;
  }
  return undefined;
}

/** Infer HTML input type from label text (UI only; explicit `type` prop wins). */
export function inputTypeFromLabel(label: unknown): InputType | undefined {
  if (typeof label !== 'string') return undefined;
  const key = normalizeLabel(label);

  if (EXACT_TYPES[key]) return EXACT_TYPES[key];

  if (
    key.includes('date & time') ||
    key.includes('date and time') ||
    key.includes('pickup date & time')
  ) {
    return 'datetime-local';
  }

  if (
    key.includes('date of birth') ||
    key.includes('expiry') ||
    key.includes('expire') ||
    key === 'issue' ||
    key === 'due' ||
    key.includes('due date') ||
    key.includes('issue date') ||
    key.includes('hire date') ||
    key.includes('effective date') ||
    key.includes('contract start') ||
    key.includes('period start') ||
    key.includes('period end') ||
    key.includes('insurance expiry') ||
    key.includes('plate expiry') ||
    key.includes('permit expiry') ||
    key.includes('performed') ||
    key.includes('next due') ||
    key.includes('inspected at') ||
    key.includes('paid at') ||
    key === 'eta date'
  ) {
    return 'date';
  }

  if (key.includes('eta time') || key.includes('time local')) {
    return 'time';
  }

  if (
    /\b(amount|weight|pieces|vacation pay|probation|notice period|lockout minutes|session days|failed attempts|wait time|detention hours|team rate|mileage|miles|qty|quantity|cost|docks|min password)\b/.test(
      key,
    ) ||
    (key.includes('rate') && !key.includes('operating')) ||
    key.includes('detention rate')
  ) {
    return 'number';
  }

  if (key.includes('email')) return 'email';
  if (key.includes('password')) return 'password';
  if (key.includes('phone') || key.includes('mobile') || key.includes('fax') || key.includes('sms')) {
    return 'tel';
  }
  if (key.includes('website') || key.includes(' url') || key.includes('logo url') || key.includes('file url')) {
    return 'url';
  }
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
  const key = normalizeLabel(label);
  return LABEL_HINTS[key] ?? placeholderFromPatterns(key);
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
