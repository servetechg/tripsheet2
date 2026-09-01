/**
 * Chapter 6.19 acceptance — in-process architecture contracts (Phase 9).
 *
 *   1. Lifecycle — pending_review → approve requires dispatch-ready; active allows dispatch
 *   2. Expired medical blocks dispatch-ready
 *   3. Equipment primary assignment closes prior row (history retained)
 */
import {
  authStatusForLifecycle,
  availabilityAllowsDispatch,
  checkBorderEligibility,
  computeQualificationStatus,
  lifecycleAllowsDispatch,
  lifecycleBlocksLogin,
  syncActiveFromLifecycle,
} from '@tripsheet/shared';
import { QualificationsService } from '../qualifications/qualifications.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('Chapter 6.19 acceptance (driver-service)');

const qualSvc = new QualificationsService({} as any, {} as any);

// ─── #1 Lifecycle transitions ───────────────────────────────────────────────
{
  assert(lifecycleAllowsDispatch('active'), '#1 active is dispatch-eligible');
  assert(!lifecycleAllowsDispatch('pending_review'), '#1 pending blocked');
  assert(!lifecycleAllowsDispatch('suspended'), '#1 suspended blocked');
  assert(lifecycleBlocksLogin('suspended'), '#1 suspended blocks login');
  assert(!lifecycleBlocksLogin('active'), '#1 active may login');
  assert(authStatusForLifecycle('suspended') === 'suspended', '#1 auth sync suspended');
  assert(authStatusForLifecycle('archived') === 'archived', '#1 auth sync archived');
  assert(syncActiveFromLifecycle('active'), '#1 active boolean sync');
  assert(!syncActiveFromLifecycle('terminated'), '#1 terminated not active boolean');
}

// ─── #2 Expired medical blocks dispatch-ready ───────────────────────────────
{
  const blockers = qualSvc.getDispatchBlockers(
    [
      { type: 'license', status: 'valid' },
      { type: 'medical', status: 'expired' },
    ],
    [
      { type: 'license', status: 'uploaded', expiryDate: '2099-01-01' },
      { type: 'abstract', status: 'uploaded', expiryDate: null },
    ],
  );
  assert(blockers.includes('medical'), '#2 expired medical in blockers');
  assert(!blockers.includes('license'), '#2 valid license ok');

  const ready =
    lifecycleAllowsDispatch('active') &&
    availabilityAllowsDispatch('available') &&
    blockers.length === 0;
  assert(!ready, '#2 not dispatch-ready with expired medical');

  assert(
    computeQualificationStatus('2000-01-01') === 'expired',
    '#2 computeQualificationStatus marks past expiry',
  );
}

// ─── #3 Equipment assignment history (close prior primary) ────────────────────
{
  type Row = {
    id: string;
    assetType: string;
    role: string;
    assetId: string;
    unassignedAt: Date | null;
  };

  function closePriorPrimary(rows: Row[], assetType: string, now = new Date()) {
    return rows.map((r) =>
      r.assetType === assetType && r.role === 'primary' && !r.unassignedAt
        ? { ...r, unassignedAt: now }
        : r,
    );
  }

  let history: Row[] = [
    {
      id: 'a1',
      assetType: 'truck',
      role: 'primary',
      assetId: 'truck-A',
      unassignedAt: null,
    },
  ];
  history = closePriorPrimary(history, 'truck');
  history.push({
    id: 'a2',
    assetType: 'truck',
    role: 'primary',
    assetId: 'truck-B',
    unassignedAt: null,
  });

  assert(history.length === 2, '#3 history retained both rows');
  assert(history[0].unassignedAt != null, '#3 truck A closed');
  assert(history[1].unassignedAt == null, '#3 truck B active');
  assert(history[0].assetId === 'truck-A', '#3 truck A id preserved');
}

// ─── Customs eligibility contract ───────────────────────────────────────────
{
  const ok = checkBorderEligibility({
    qualifications: [
      { type: 'passport', status: 'valid' },
      { type: 'medical', status: 'valid' },
    ],
    documents: [],
    citizenship: 'CA',
    fastCard: null,
  });
  assert(ok.eligible, '#15 CA citizen border-eligible with passport+medical');
  assert(ok.warnings.includes('fast'), '#15 FAST recommended warning');

  const bad = checkBorderEligibility({
    qualifications: [{ type: 'medical', status: 'valid' }],
    documents: [],
    citizenship: 'IN',
    fastCard: null,
  });
  assert(!bad.eligible, '#15 missing passport/work auth blocked');
}

console.log('chapter 6.19 acceptance contracts ok (driver)');
