export interface GeoapifyAddress {
  formatted: string;
  address_line1?: string;
  address_line2?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
  name?: string;
}

export interface GeoapifyAutocompleteResponse {
  results?: GeoapifyAddress[];
}

const GEOAPIFY_API_KEY =
  (import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined)?.trim() ||
  'facbaff1f6804680951c87a68f3c0073';

/**
 * Searches address suggestions in USA and Canada using Geoapify Autocomplete API.
 * Returns an empty array if the key is missing, the query is too short, or an error occurs.
 */
export async function searchGeoapifyAutocomplete(
  query: string,
  signal?: AbortSignal,
): Promise<GeoapifyAddress[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2 || !GEOAPIFY_API_KEY) {
    return [];
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.set('text', trimmed);
  url.searchParams.set('format', 'json');
  // Restrict to USA and Canada only
  url.searchParams.set('filter', 'countrycode:us,ca');
  url.searchParams.set('limit', '8');
  url.searchParams.set('apiKey', GEOAPIFY_API_KEY);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as GeoapifyAutocompleteResponse;
    return Array.isArray(data.results) ? data.results : [];
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return [];
    }
    // Fail gracefully on network or other issues
    return [];
  }
}

/**
 * Helper to get country flag emoji for US or CA.
 */
export function getCountryFlag(countryCode?: string): string {
  const code = (countryCode || '').toLowerCase();
  if (code === 'ca') return '🇨🇦';
  if (code === 'us') return '🇺🇸';
  return '📍';
}
