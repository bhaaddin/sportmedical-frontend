/*
 * vercel.json carries the security headers (SEC-02): the safe set is enforced on every path, the strict content policy runs
 * as Report-Only (nothing can break), and the enforced policy has no script/style/connect rule that could block the app.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Header = { key: string; value: string };
const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: Header[] }[] };
const all = config.headers.find((h) => h.source === '/(.*)')!.headers;
const value = (key: string) => all.find((h) => h.key === key)?.value;

describe('vercel.json security headers', () => {
  it('enforces framing, sniffing, referrer, permissions and HSTS on every path', () => {
    expect(value('X-Frame-Options')).toBe('DENY');
    expect(value('X-Content-Type-Options')).toBe('nosniff');
    expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(value('Permissions-Policy')).toContain('camera=()');
    expect(value('Strict-Transport-Security')).toMatch(/max-age=\d{8,}/);
  });

  it('enforces only what cannot break a screen; the strict policy is Report-Only', () => {
    const enforced = value('Content-Security-Policy')!;
    expect(enforced).toContain("frame-ancestors 'none'");
    for (const directive of ['script-src', 'default-src', 'style-src', 'connect-src', 'img-src']) expect(enforced).not.toContain(directive);
    const report = value('Content-Security-Policy-Report-Only')!;
    expect(report).toContain("script-src 'self'");
    expect(report).toContain('connect-src');
  });

  it('keeps the long cache on hashed assets', () => {
    const assets = config.headers.find((h) => h.source === '/assets/(.*)')!;
    expect(assets.headers.some((h) => h.key === 'Cache-Control' && h.value.includes('immutable'))).toBe(true);
  });
});
