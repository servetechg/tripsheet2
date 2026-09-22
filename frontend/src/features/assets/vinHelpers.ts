export function normalizeVinInput(raw: string): string {
  return String(raw || '')
    .replace(/\s/g, '')
    .toUpperCase();
}

export function isCompleteVin(vin: string): boolean {
  return normalizeVinInput(vin).length === 17;
}

export function isValidVinFormat(vin: string): boolean {
  const v = normalizeVinInput(vin);
  if (v.length !== 17) return false;
  if (/[IOQ]/.test(v)) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}
