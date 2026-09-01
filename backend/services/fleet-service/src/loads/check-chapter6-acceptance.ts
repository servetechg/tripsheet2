/**
 * Chapter 6.19 acceptance — fleet-side dispatch gate contracts (Phase 9).
 *
 *   2. Expired / missing credentials block load assignment (server-side)
 */
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('Chapter 6.19 acceptance (fleet-service)');

type DispatchReady = {
  ready?: boolean;
  missing?: string[];
  lifecycleOk?: boolean;
  lifecycleStatus?: string;
  availabilityOk?: boolean;
  availabilityStatus?: string;
};

function lifecycleAllowsDispatch(status?: string | null): boolean {
  return status === 'active';
}

function availabilityAllowsDispatch(status?: string | null): boolean {
  if (!status || status === 'available') return true;
  if (status === 'on_dispatch') return false;
  return !['unavailable', 'off_duty', 'vacation', 'medical_leave', 'training', 'maintenance_delay'].includes(
    status,
  );
}

function fleetAssignmentBlockReason(
  driverName: string,
  ready: DispatchReady,
): string | null {
  if (ready.lifecycleOk === false) {
    return `Driver ${driverName} is ${ready.lifecycleStatus || 'not active'} and cannot be assigned`;
  }
  if (ready.availabilityOk === false) {
    return `Driver ${driverName} is ${ready.availabilityStatus || 'unavailable'} and cannot be assigned`;
  }
  if (!ready.ready) {
    const missing = (ready.missing || []).join(', ');
    return `Driver ${driverName} is not dispatch-ready (missing/expired: ${missing})`;
  }
  return null;
}

// ─── #2 Server-side dispatch block on expired medical ─────────────────────────
{
  const reason = fleetAssignmentBlockReason('Jane Doe', {
    lifecycleOk: true,
    availabilityOk: true,
    ready: false,
    missing: ['medical'],
  });
  assert(reason != null, '#2 assignment blocked');
  assert(/medical/i.test(reason!), '#2 reason cites medical');
  assert(/dispatch-ready/i.test(reason!), '#2 dispatch-ready wording');
  assert(reason!.includes('Jane Doe'), '#2 reason names driver');
}

{
  const reason = fleetAssignmentBlockReason('Bob', {
    lifecycleOk: false,
    lifecycleStatus: 'suspended',
    availabilityOk: true,
    ready: false,
    missing: [],
  });
  assert(/suspended/i.test(reason || ''), '#2 suspended lifecycle blocked');
}

{
  const reason = fleetAssignmentBlockReason('Bob', {
    lifecycleOk: true,
    availabilityOk: false,
    availabilityStatus: 'vacation',
    ready: false,
    missing: [],
  });
  assert(/vacation/i.test(reason || ''), '#2 vacation availability blocked');
  assert(!availabilityAllowsDispatch('vacation'), '#2 vacation helper');
  assert(lifecycleAllowsDispatch('active'), '#2 active lifecycle helper');
}

{
  assert(
    fleetAssignmentBlockReason('Ok Driver', {
      ready: true,
      lifecycleOk: true,
      availabilityOk: true,
    }) == null,
    '#2 ready driver proceeds',
  );
}

console.log('chapter 6.19 acceptance contracts ok (fleet)');
