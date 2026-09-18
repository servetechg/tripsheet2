export type TripCountry = 'US' | 'CA';

export function normalizeTripCountry(
  code?: string | null,
): TripCountry | '' {
  const c = String(code || '').trim().toUpperCase();
  if (c === 'US' || c === 'USA') return 'US';
  if (c === 'CA' || c === 'CAN') return 'CA';
  return '';
}

/** Infer country from free-text address when no structured code is stored. */
export function inferCountryFromAddress(text?: string | null): TripCountry | '' {
  const t = String(text || '').toLowerCase();
  if (!t) return '';
  if (
    t.includes('canada') ||
    /\b(ab|bc|mb|nb|nl|ns|nt|nu|on|pe|qc|sk|yt)\b/.test(t) ||
    /\b[a-z]\d[a-z]\s?\d[a-z]\d\b/i.test(t)
  ) {
    return 'CA';
  }
  if (
    t.includes('united states') ||
    t.includes(', usa') ||
    t.includes(' u.s.') ||
    /\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/.test(
      t,
    )
  ) {
    return 'US';
  }
  return '';
}

export function countryLabel(code: TripCountry | ''): string {
  if (code === 'US') return 'United States';
  if (code === 'CA') return 'Canada';
  return '';
}

export function countryFlag(code: TripCountry | ''): string {
  if (code === 'US') return '🇺🇸';
  if (code === 'CA') return '🇨🇦';
  return '📍';
}

/** Opposite country for cross-border CA↔US trips. */
export function oppositeCountry(code: TripCountry): TripCountry {
  return code === 'US' ? 'CA' : 'US';
}

/**
 * Allowed countries for destination autocomplete given cross-border mode and origin.
 * - Cross-border + origin known → opposite country only
 * - Domestic + origin known → same country only
 * - Otherwise → both US and CA
 */
export function allowedCountriesForDestination(
  crossBorder: boolean,
  originCountry: TripCountry | '',
): TripCountry[] {
  if (originCountry) {
    return crossBorder ? [oppositeCountry(originCountry)] : [originCountry];
  }
  return ['US', 'CA'];
}

export function allowedCountriesForOrigin(
  crossBorder: boolean,
  destinationCountry: TripCountry | '',
): TripCountry[] {
  if (destinationCountry) {
    return crossBorder ? [oppositeCountry(destinationCountry)] : [destinationCountry];
  }
  return ['US', 'CA'];
}

/** Customs program for direction of travel (country being entered). */
export function customsProgramForRoute(
  originCountry: TripCountry | '',
  destinationCountry: TripCountry | '',
): 'ACE' | 'ACI' | '' {
  if (originCountry === 'CA' && destinationCountry === 'US') return 'ACE';
  if (originCountry === 'US' && destinationCountry === 'CA') return 'ACI';
  return '';
}

export function validateRouteCountries(
  crossBorder: boolean,
  originCountry: TripCountry | '',
  destinationCountry: TripCountry | '',
): { origin?: string; destination?: string } {
  const errs: { origin?: string; destination?: string } = {};
  if (!originCountry) {
    errs.origin =
      'Select origin from suggestions or master list so country is detected';
  }
  if (!destinationCountry) {
    errs.destination =
      'Select destination from suggestions or master list so country is detected';
  }
  if (!originCountry || !destinationCountry) return errs;

  if (crossBorder) {
    if (originCountry === destinationCountry) {
      errs.destination =
        'Cross-border trips must go from US to Canada or Canada to US';
    }
  } else if (originCountry !== destinationCountry) {
    errs.destination =
      'Domestic trips must stay in one country (both US or both Canada)';
  }
  return errs;
}
