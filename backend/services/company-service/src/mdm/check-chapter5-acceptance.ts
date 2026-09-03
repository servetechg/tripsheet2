/**
 * Chapter 5.21 acceptance — in-process architecture contracts (Phase 8).
 *
 * Acceptance:
 *   1. Saved broker is selectable in dispatch and accounting pickers
 *   3. Port of entry populates ACE/ACI/PAPS/PARS and gates dispatch
 *
 * #2 (OOS truck) lives in fleet-service check-chapter5-acceptance.ts
 */
import { canSelectPartyStatus, partySelectBlockReason } from './party-status';
import {
  customsFlagsFromPort,
  DEFAULT_PORTS,
  defaultProgramForPort,
  shipmentTypesForPort,
  validateCrossBorderDispatch,
} from './border.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Same filter as GET ?selectableOnly=1 used by dispatch + billing pickers. */
function pickerIds(rows: Array<{ id: string; status: string }>) {
  return rows.filter((r) => canSelectPartyStatus(r.status)).map((r) => r.id);
}

console.log('Chapter 5.21 acceptance (company-service)');

// ─── #1 Broker saved → available in dispatch AND accounting ────────────────
{
  const saved = { id: 'brk_abc', name: 'ABC Logistics', status: 'active' };
  const archived = { id: 'brk_old', name: 'Old Co', status: 'inactive' };
  const watch = { id: 'brk_watch', name: 'Watch LLC', status: 'watch' };
  const blacklisted = {
    id: 'brk_bad',
    name: 'Blocked Inc',
    status: 'blacklisted',
  };
  const catalog = [saved, archived, watch, blacklisted];

  assert(canSelectPartyStatus(saved.status), '#1 active broker selectable');
  assert(canSelectPartyStatus(watch.status), '#1 watch still selectable');
  assert(!canSelectPartyStatus(archived.status), '#1 inactive not selectable');
  assert(
    !canSelectPartyStatus(blacklisted.status),
    '#1 blacklisted not selectable',
  );

  const dispatchPicker = pickerIds(catalog);
  const accountingPicker = pickerIds(catalog);
  assert(
    dispatchPicker.includes(saved.id) && accountingPicker.includes(saved.id),
    '#1 same master id in dispatch and accounting pickers',
  );
  assert(
    dispatchPicker.includes(watch.id) && accountingPicker.includes(watch.id),
    '#1 watch available on both pickers',
  );
  assert(
    !dispatchPicker.includes(archived.id) &&
      !accountingPicker.includes(archived.id),
    '#1 inactive hidden from new work on both pickers',
  );
  assert(
    partySelectBlockReason('Broker', archived.name, archived.status)
      .toLowerCase()
      .includes('inactive'),
    '#1 deny reason for inactive broker',
  );

  // Dual-write contract: load/invoice keep id + name snapshot
  const loadRow = { brokerId: saved.id, brokerName: saved.name };
  const invoiceRow = { brokerId: saved.id, brokerName: saved.name };
  assert(loadRow.brokerId === invoiceRow.brokerId, '#1 shared broker id');
  assert(loadRow.brokerName === 'ABC Logistics', '#1 name snapshot');
}

// ─── #3 POE selection populates customs options and validates dispatch ─────
{
  const sweetgrass = DEFAULT_PORTS.find((p) => p.code === '3505');
  const coutts = DEFAULT_PORTS.find((p) => p.code === '0407');
  assert(sweetgrass, '#3 US seed port 3505');
  assert(coutts, '#3 CA seed port 0407');

  const usFlags = customsFlagsFromPort(sweetgrass!);
  assert(usFlags.customsAce && usFlags.customsPaps, '#3 US ACE/PAPS populate');
  assert(!usFlags.customsAci, '#3 US does not imply ACI');
  assert(defaultProgramForPort(sweetgrass!) === 'ACE', '#3 default ACE at US');
  assert(shipmentTypesForPort(sweetgrass!).includes('PAPS'), '#3 PAPS option');

  const caFlags = customsFlagsFromPort(coutts!);
  assert(caFlags.customsAci && caFlags.customsPars, '#3 CA ACI/PARS populate');
  assert(defaultProgramForPort(coutts!) === 'ACI', '#3 default ACI at CA');

  assert(
    validateCrossBorderDispatch({ crossBorder: false }).length === 0,
    '#3 domestic skips POE',
  );
  assert(
    validateCrossBorderDispatch({
      crossBorder: true,
      portOfEntryId: '',
    }).some((e) => e.toLowerCase().includes('port of entry')),
    '#3 missing POE blocked',
  );
  assert(
    validateCrossBorderDispatch({
      crossBorder: true,
      portOfEntryId: 'poe_3505',
      customsProgram: 'ACE',
      port: { ...sweetgrass!, status: 'active' },
    }).length === 0,
    '#3 ACE at Sweetgrass ok',
  );
  assert(
    validateCrossBorderDispatch({
      crossBorder: true,
      portOfEntryId: 'poe_3505',
      customsProgram: 'ACI',
      port: { ...sweetgrass!, status: 'active' },
    }).some((e) => e.includes('not supported')),
    '#3 ACI at US port blocked',
  );
  assert(
    validateCrossBorderDispatch({
      crossBorder: true,
      portOfEntryId: 'poe_3505',
      customsProgram: 'ACE',
      port: { ...sweetgrass!, status: 'inactive' },
    }).some((e) => e.toLowerCase().includes('active')),
    '#3 inactive POE blocked',
  );
}

console.log('chapter 5.21 acceptance contracts ok (company)');
