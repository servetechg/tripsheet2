/**
 * In-process MDM Phase 5 border / POE helpers.
 */
import {
  customsFlagsFromPort,
  DEFAULT_PORTS,
  defaultProgramForPort,
  programSupportedByPort,
  shipmentTypesForPort,
  uniqueBorderCrossingNames,
  validateCrossBorderDispatch,
} from './border.util';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(DEFAULT_PORTS.length >= 20, 'seed size');
assert(DEFAULT_PORTS.some((p) => p.country === 'CA' && p.aci && p.pars), 'CA ACI');
assert(DEFAULT_PORTS.some((p) => p.country === 'US' && p.ace && p.paps), 'US ACE');
assert(uniqueBorderCrossingNames().includes('Coutts–Sweetgrass'), 'crossing');

const sweetgrass = DEFAULT_PORTS.find((p) => p.code === '3505')!;
assert(defaultProgramForPort(sweetgrass) === 'ACE', 'default ACE');
assert(programSupportedByPort('ACE', sweetgrass), 'ACE ok');
assert(!programSupportedByPort('ACI', sweetgrass), 'ACI blocked at US');
assert(shipmentTypesForPort(sweetgrass).includes('PAPS'), 'PAPS option');

const flags = customsFlagsFromPort(sweetgrass);
assert(flags.customsAce && flags.customsPaps, 'flags');

assert(
  validateCrossBorderDispatch({ crossBorder: false }).length === 0,
  'domestic ok',
);
assert(
  validateCrossBorderDispatch({
    crossBorder: true,
    portOfEntryId: '',
  }).some((e) => e.includes('Port of entry')),
  'needs POE',
);
assert(
  validateCrossBorderDispatch({
    crossBorder: true,
    portOfEntryId: 'poe_1',
    customsProgram: 'ACE',
    port: sweetgrass,
  }).length === 0,
  'cross-border ok',
);
assert(
  validateCrossBorderDispatch({
    crossBorder: true,
    portOfEntryId: 'poe_1',
    customsProgram: 'ACI',
    port: sweetgrass,
  }).some((e) => e.includes('not supported')),
  'wrong program',
);

console.log('mdm border helpers ok');
