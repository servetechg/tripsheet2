/** True when localStorage access token exists and JWT exp is in the future. */
export function isAccessTokenValidForSocket(): boolean {
  const token = localStorage.getItem('ts_token')?.trim();
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 > Date.now() + 10_000;
  } catch {
    return false;
  }
}
