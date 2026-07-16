/** Resolve the driver-service record id used for documents/contracts. */
export function driverRecordIdOf(driver: {
  id: string;
  driverRecordId?: string | null;
}): string {
  return driver.driverRecordId || driver.id;
}

/**
 * Match an entity's driverId against a UI driver (auth user id and/or
 * driver-service record id). Documents use the record id; loads/sheets may
 * use the auth user id.
 */
export function matchesDriverRef(
  entityDriverId: string | null | undefined,
  driver: { id: string; driverRecordId?: string | null },
): boolean {
  if (!entityDriverId) return false;
  if (entityDriverId === driver.id) return true;
  if (driver.driverRecordId && entityDriverId === driver.driverRecordId) {
    return true;
  }
  return false;
}
