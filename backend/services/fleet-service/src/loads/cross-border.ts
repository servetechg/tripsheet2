/**
 * Cross-border dispatch gate (MDM Phase 5 / acceptance #3).
 * Kept in fleet-service so create/update can enforce without calling company-service.
 */

export function validateCrossBorderLoadFields(input: {
  crossBorder?: boolean;
  portOfEntryId?: string | null;
  customsProgram?: string | null;
  customsAce?: boolean;
  customsAci?: boolean;
  customsPaps?: boolean;
  customsPars?: boolean;
}): string[] {
  const errors: string[] = [];
  if (!input.crossBorder) return errors;
  if (!input.portOfEntryId) {
    errors.push('Port of entry is required for cross-border dispatch');
  }
  const program = String(input.customsProgram || '').toUpperCase();
  if (!program) {
    errors.push('Customs program (ACE or ACI) is required for cross-border dispatch');
  } else if (program !== 'ACE' && program !== 'ACI') {
    errors.push('Customs program must be ACE or ACI');
  } else if (program === 'ACE') {
    if (!input.customsAce) {
      errors.push('Selected port does not support ACE');
    }
    if (!input.customsPaps && !input.customsAce) {
      errors.push('Selected port does not support ACE/PAPS filing options');
    }
  } else if (program === 'ACI') {
    if (!input.customsAci) {
      errors.push('Selected port does not support ACI');
    }
    if (!input.customsPars && !input.customsAci) {
      errors.push('Selected port does not support ACI/PARS filing options');
    }
  }
  return errors;
}
