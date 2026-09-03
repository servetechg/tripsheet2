/** Cross-border driver eligibility (Chapter 6 §6.15) */
export const BORDER_REQUIRED = ['passport', 'medical', 'work_authorization'] as const;
export const BORDER_RECOMMENDED = ['fast'] as const;

export type BorderEligibilityResult = {
  eligible: boolean;
  missing: string[];
  warnings: string[];
};

type QualRow = { type: string; status: string };
type DocRow = { type: string; status: string; expiryDate?: string | null };

export function checkBorderEligibility(input: {
  qualifications: QualRow[];
  documents: DocRow[];
  citizenship?: string | null;
  fastCard?: string | null;
}): BorderEligibilityResult {
  const today = new Date().toISOString().slice(0, 10);
  const missing: string[] = [];
  const warnings: string[] = [];

  const qualOk = (type: string) => {
    const q = input.qualifications.find((x) => x.type === type);
    return q && q.status !== 'expired' && q.status !== 'missing';
  };

  const docOk = (type: string) => {
    const d = input.documents.find((x) => x.type === type);
    if (!d || d.status === 'expired') return false;
    if (d.expiryDate && d.expiryDate < today) return false;
    return true;
  };

  const hasPassport =
    qualOk('passport') ||
    docOk('border_doc') ||
    Boolean(input.documents.find((d) => d.type === 'passport'));
  if (!hasPassport) missing.push('passport');

  const hasMedical = qualOk('medical') || docOk('medical');
  if (!hasMedical) missing.push('medical');

  const citizen = (input.citizenship || '').toUpperCase();
  const hasWorkAuth =
    citizen === 'CA' ||
    citizen === 'US' ||
    qualOk('work_permit') ||
    qualOk('visa') ||
    docOk('permit') ||
    docOk('border_doc');
  if (!hasWorkAuth) missing.push('work_authorization');

  const hasFast =
    qualOk('fast') ||
    Boolean(input.fastCard?.trim()) ||
    docOk('fast_card');
  if (!hasFast) warnings.push('fast');

  return {
    eligible: missing.length === 0,
    missing,
    warnings,
  };
}
