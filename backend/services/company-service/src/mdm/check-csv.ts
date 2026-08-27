/**
 * In-process MDM Phase 7 CSV helpers.
 */
import { parseCsv, toCsv } from './csv.util';
import {
  isMdmIoEntity,
  MDM_IO_COLUMNS,
  validateIoRow,
} from './mdm-io.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isMdmIoEntity('brokers'), 'entity');
assert(!isMdmIoEntity('carriers'), 'phase7 only');
assert(MDM_IO_COLUMNS.brokers.includes('mc'), 'broker cols');

const csv = toCsv(['name', 'mc'], [{ name: 'ABC Logistics', mc: 'MC-1' }]);
assert(csv.includes('ABC Logistics'), 'serialize');
const parsed = parseCsv(csv);
assert(parsed.rows[0].name === 'ABC Logistics', 'parse name');
assert(parsed.rows[0].mc === 'MC-1', 'parse mc');

const quoted = parseCsv('name,notes\n"A, Inc.","line1\nline2"\n');
assert(quoted.rows[0].name === 'A, Inc.', 'quoted comma');
assert(quoted.rows[0].notes.includes('line1'), 'quoted newline');

const bad = validateIoRow('brokers', { name: '', mc: '' }, 2);
assert(bad.errors.some((e) => e.field === 'name'), 'required name');

const ok = validateIoRow(
  'brokers',
  { name: 'ABC', mc: '123', status: 'active' },
  2,
);
assert(ok.ok?.body.name === 'ABC', 'broker body');
assert(ok.ok?.key.startsWith('mc:'), 'mc key');

const loc = validateIoRow(
  'locations',
  { name: '', city: 'Calgary', region: 'AB', country: 'CA' },
  2,
);
assert(loc.ok?.body.city === 'Calgary', 'location city');

const cmd = validateIoRow(
  'commodities',
  { name: 'Auto Parts', hazmat: 'yes', status: 'active' },
  2,
);
assert(cmd.ok?.body.hazmat === true, 'hazmat bool');

console.log('mdm csv io helpers ok');
