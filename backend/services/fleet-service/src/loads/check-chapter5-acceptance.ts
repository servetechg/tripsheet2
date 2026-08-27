/**
 * Chapter 5.21 acceptance — fleet-side contracts (Phase 8).
 *
 *   2. Out of Service truck cannot be assigned; reason shown
 *   3. Cross-border load fields require POE + supported ACE/ACI flags
 */
import {
  assetAssignmentBlockReason,
  canAssignAssetStatus,
} from '../assets/asset-status';
import { validateCrossBorderLoadFields } from './cross-border';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('Chapter 5.21 acceptance (fleet-service)');

// ─── #2 Truck OOS cannot be assigned; reason shown ─────────────────────────
{
  assert(canAssignAssetStatus('available'), '#2 available assignable');
  assert(!canAssignAssetStatus('out_of_service'), '#2 OOS not assignable');
  assert(!canAssignAssetStatus('Out of Service'), '#2 OOS label not assignable');
  const reason = assetAssignmentBlockReason('out_of_service', 'T-101');
  assert(reason.includes('Out of Service'), '#2 reason names OOS');
  assert(reason.includes('T-101'), '#2 reason names unit');
  assert(reason.toLowerCase().includes('cannot be assigned'), '#2 cannot assign');
}

// ─── #3 Fleet create/update gate (flags populated from POE customs) ────────
{
  const fromPoe = {
    crossBorder: true,
    portOfEntryId: 'poe_3505',
    customsProgram: 'ACE',
    customsAce: true,
    customsPaps: true,
    customsAci: false,
    customsPars: false,
  };
  assert(
    validateCrossBorderLoadFields(fromPoe).length === 0,
    '#3 populated ACE/PAPS proceeds',
  );
  assert(
    validateCrossBorderLoadFields({
      crossBorder: true,
      customsProgram: 'ACE',
      customsAce: true,
      customsPaps: true,
    }).some((e) => e.includes('Port of entry')),
    '#3 missing POE blocked before dispatch',
  );
  assert(
    validateCrossBorderLoadFields({
      ...fromPoe,
      customsProgram: 'ACI',
      customsAci: false,
    }).some((e) => e.includes('ACI')),
    '#3 unsupported program blocked',
  );
}

console.log('chapter 5.21 acceptance contracts ok (fleet)');
