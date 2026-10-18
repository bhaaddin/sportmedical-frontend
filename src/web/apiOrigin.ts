/*
 * The origin (scheme + host + port) of the API when the build is told one, else null.
 *
 * `VITE_API_BASE_URL` is empty when the API sits on the page's own origin (the dev proxy, the Docker/nginx setup): there
 * is nothing to announce. In the hosted setup it is the API's absolute address, and vite.config.ts writes
 * `<link rel="preconnect">` / `dns-prefetch` for that origin into the HTML so the connection (DNS + TLS, about three
 * round trips) is ready before the first request. Read from the environment at build time, never typed in the source.
 */
export function apiOriginOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}
