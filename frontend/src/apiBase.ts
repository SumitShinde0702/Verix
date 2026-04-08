/**
 * Production: set VITE_API_BASE_URL at build time (e.g. Vercel env) to your API origin, no trailing slash.
 * Local dev: leave unset so Vite proxies /api to the backend.
 */
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
export const API_BASE_URL = raw.replace(/\/$/, '');

export function apiUrl(pathAndQuery: string): string {
  const p = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
  return API_BASE_URL ? `${API_BASE_URL}${p}` : p;
}
