/*
 * The ONE place that turns a link the server hands out (`formUrl`, `registrationUrl`, a path like `/klub/abc`)
 * into the address a club is sent.
 *
 *  - The base is the public site address the administrator set (setting `pub.siteUrl`), so the short, final
 *    domain is what a club sees - never the long preview address of the place the staff app happens to run on.
 *  - Until that setting exists, the base is this app's own origin (`window.location.origin`).
 *  - A link the server already made absolute keeps its path; only its origin is replaced by the public base.
 */
import { useEffect, useState } from 'react';
import { readSettings } from '../../../api/clinicSettings';

/** The setting key of the public site address (an origin such as https://www.example.cz). */
export const PUBLIC_SITE_URL_KEY = 'pub.siteUrl';

const ABSOLUTE = /^https?:\/\//i;

/** `https://host` from whatever the administrator typed ("host.cz", "https://host.cz/", ...); '' when unusable. */
export function normalizeBase(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (text === '') return '';
  const withScheme = ABSOLUTE.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.origin;
  } catch {
    return '';
  }
}

const currentOrigin = (): string => (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * The absolute link for a path. `base` is the admin-set public address (empty/absent = this app's origin).
 * An empty path stays empty (the order has no link yet).
 */
export function absoluteLink(path: string | null | undefined, base?: string | null): string {
  const raw = (path ?? '').trim();
  if (raw === '') return '';
  const origin = normalizeBase(base) || '';
  if (ABSOLUTE.test(raw)) {
    if (origin === '') return raw;
    try {
      const url = new URL(raw);
      return `${origin}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return raw;
    }
  }
  const root = origin !== '' ? origin : currentOrigin().replace(/\/+$/, '');
  return `${root}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/** The link as it is shown: without the scheme and without a trailing slash ("www.example.cz/klub-objednavka/abc"). */
export function shortLink(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/* ── The public address, read once per page load ── */

let cached: string | null = null;
let pending: Promise<string> | null = null;

async function loadBase(): Promise<string> {
  if (cached !== null) return cached;
  pending ??= (async () => {
    try {
      const values = await readSettings([PUBLIC_SITE_URL_KEY]);
      return normalizeBase(values[PUBLIC_SITE_URL_KEY]);
    } catch {
      return '';
    }
  })();
  const value = await pending;
  cached = value;
  return value;
}

/** For tests: forget what was read. */
export function resetPublicSiteBase(): void {
  cached = null;
  pending = null;
}

/** The admin-set public site address ('' = none set: links fall back to this app's origin). */
export function usePublicSiteBase(): string {
  const [base, setBase] = useState<string>(cached ?? '');
  useEffect(() => {
    let live = true;
    void loadBase().then((value) => {
      if (live) setBase(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return base;
}
