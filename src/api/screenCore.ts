/* What the screen routes (screens.ts, overviewScreen.ts) share: the memo of what the server taught us and the section readers. */
const BACKOFF_MS = 60_000;
const UNSUPPORTED_MS = 10 * 60_000;

export type Section = { data?: unknown; error?: unknown } | null | undefined;

export const dataOf = (section: Section): unknown =>
  section === null || section === undefined || typeof section !== 'object' || section.data === null ? undefined : section.data;

/** What a screen route taught us about the server, remembered for this tab. */
export function makeMemo(name: string) {
  const key = `sm.screen.${name}.unsupportedUntil`;
  const read = (): number => {
    try {
      const at = Number(window.sessionStorage.getItem(key));
      return Number.isFinite(at) ? at : 0;
    } catch {
      return 0;
    }
  };
  let blockedUntil = read();
  return {
    blocked: (): boolean => Date.now() < blockedUntil,
    reset: (): void => {
      blockedUntil = 0;
      try { window.sessionStorage.removeItem(key); } catch { /* nothing stored */ }
    },
    learn: (error: unknown): void => {
      const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | undefined)?.response;
      const status = response?.status;
      if (status === 401 || status === 403) return;
      if (status === 404 && typeof response?.data?.code === 'string') return;
      const unsupported = status === 404 || status === 405;
      blockedUntil = Date.now() + (unsupported ? UNSUPPORTED_MS : BACKOFF_MS);
      if (unsupported) {
        try { window.sessionStorage.setItem(key, String(blockedUntil)); } catch { /* this load asks once more */ }
      }
    },
  };
}

export const sectionsOf = (body: unknown): Record<string, Section> | null => {
  const sections = (body as { sections?: unknown } | null)?.sections;
  return sections !== null && typeof sections === 'object' ? (sections as Record<string, Section>) : null;
};

export const attempt = <T,>(run: () => T | undefined): T | undefined => {
  try {
    return run();
  } catch {
    return undefined;
  }
};

