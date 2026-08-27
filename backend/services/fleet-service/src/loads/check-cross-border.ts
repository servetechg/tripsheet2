/**
 * In-process fleet cross-border gate.
 */
import { validateCrossBorderLoadFields } from './cross-border';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(validateCrossBorderLoadFields({ crossBorder: false }).length === 0, 'dom');
assert(
  validateCrossBorderLoadFields({
    crossBorder: true,
    portOfEntryId: 'x',
    customsProgram: 'ACE',
    customsAce: true,
    customsPaps: true,
  }).length === 0,
  'ace ok',
);
assert(
  validateCrossBorderLoadFields({
    crossBorder: true,
    customsProgram: 'ACE',
    customsAce: true,
  }).some((e) => e.includes('Port of entry')),
  'needs poe',
);
assert(
  validateCrossBorderLoadFields({
    crossBorder: true,
    portOfEntryId: 'x',
    customsProgram: 'ACI',
    customsAce: true,
    customsAci: false,
  }).some((e) => e.includes('ACI')),
  'wrong flags',
);

console.log('fleet cross-border helpers ok');
