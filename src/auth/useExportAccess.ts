/* ══════════════════════════════════════════════════════════════
   MAY THIS PERSON SAVE FILES OUT OF THE SYSTEM? (R14f)

   `exports.download` is granted by an administrator (Owner and Administrator by default). The answer comes from the
   server - the stored permission list first (instant), then GET /api/v1/exports/policy (a role override can
   differ from what the sign-in stored). An older backend has no such route: nothing is blocked there, because the
   server that would refuse does not exist yet. While the answer is still on its way the buttons are NOT greyed
   out (an administrator would see a flash of "forbidden"); the server refuses a click that should not have been.

   No signed-in session (no token) means no question: public pages and tests never call the server for this.
   One answer is shared by every button on the screen and kept for a minute.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { exportsApi, EXPORT_FORBIDDEN_MESSAGE, type ExportPolicy } from '../api/exports';
import { usePermissions } from './usePermission';

export interface ExportAccess {
  allowed: boolean;
  /** Why not, in Czech; null when allowed. */
  reason: string | null;
}

/** Pure: the decision from the stored permission list and the server's answer (undefined = not asked yet / failed). */
export function exportAccessOf(permissions: readonly string[], policy: ExportPolicy | undefined): ExportAccess {
  if (permissions.includes('exports.download') || policy === 'allowed' || policy === 'unsupported' || policy === undefined) {
    return { allowed: true, reason: null };
  }
  return { allowed: false, reason: EXPORT_FORBIDDEN_MESSAGE };
}

const TTL_MS = 60_000;

let cache: { token: string; at: number; policy: ExportPolicy } | null = null;
let inflight: Promise<ExportPolicy | undefined> | null = null;

const tokenOf = (): string | null => {
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
};

/** Test hook. */
export function resetExportAccessForTests(): void {
  cache = null;
  inflight = null;
}

async function readPolicy(token: string): Promise<ExportPolicy | undefined> {
  if (cache !== null && cache.token === token && Date.now() - cache.at < TTL_MS) return cache.policy;
  inflight ??= exportsApi
    .policy()
    .then((policy) => {
      cache = { token, at: Date.now(), policy };
      return policy;
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useExportAccess(): ExportAccess {
  const permissions = usePermissions();
  const stored = permissions.includes('exports.download');
  const token = tokenOf();
  const [policy, setPolicy] = useState<ExportPolicy | undefined>(() =>
    cache !== null && cache.token === token ? cache.policy : undefined,
  );

  useEffect(() => {
    if (stored || token === null) return undefined;
    let live = true;
    void readPolicy(token).then((next) => {
      if (live) setPolicy(next);
    });
    return () => {
      live = false;
    };
  }, [stored, token]);

  return exportAccessOf(permissions, policy);
}
