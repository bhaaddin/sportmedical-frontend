/* ══════════════════════════════════════════════════════════════
   WHAT THIS PERSON CHOSE FOR THEMSELVES

   The theme and the workspace, as the server last said them: written at
   sign-in and by every refresh of GET /api/v1/account, and by Můj účet
   the moment a save goes through. A small store rather than a value read
   once, so choosing a theme redraws the application right away and a
   choice made in another tab follows here.

   Nothing in here decides what anybody may DO. A workspace hides sections;
   the server still refuses what it refuses.
   ══════════════════════════════════════════════════════════════ */
import { useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_THEME, isThemeKey, type ThemeKey } from '../theme';

export const WORKSPACE_KEYS = ['full', 'doctor'] as const;

export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

export const DEFAULT_WORKSPACE: WorkspaceKey = 'full';

export function isWorkspaceKey(value: unknown): value is WorkspaceKey {
  return typeof value === 'string' && (WORKSPACE_KEYS as readonly string[]).includes(value);
}

/** The shape the server answers with (`preferences` on the account and the session). */
export interface AccountPreferences {
  theme: string;
  workspace: string;
}

/** The same, with only keys this build knows how to draw. */
export interface EffectivePreferences {
  theme: ThemeKey;
  workspace: WorkspaceKey;
}

const STORAGE_KEY = 'preferences';

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribePreferences(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function preferencesSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Parses what the store holds. Anything malformed, missing or unknown to this
 * build reads as the default for that one field - a theme that was retired
 * must not also throw away the workspace somebody chose.
 */
export function parsePreferences(raw: string | null): EffectivePreferences {
  let theme: unknown = null;
  let workspace: unknown = null;

  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        theme = (parsed as { theme?: unknown }).theme;
        workspace = (parsed as { workspace?: unknown }).workspace;
      }
    } catch {
      /* Read as never chosen. */
    }
  }

  return {
    theme: isThemeKey(theme) ? theme : DEFAULT_THEME,
    workspace: isWorkspaceKey(workspace) ? workspace : DEFAULT_WORKSPACE,
  };
}

/** Stores what the server said this person chose, and redraws whoever listens. */
export function savePreferences(preferences: AccountPreferences | null | undefined): void {
  if (!preferences || typeof preferences !== 'object') return;
  const next = JSON.stringify({ theme: preferences.theme, workspace: preferences.workspace });
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === next) return;
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* Private mode or a full quota: the server still knows, and the next refresh asks it. */
  }
  notify();
}

/** Removes the stored choice. Called by the sign-out through SESSION_KEYS. */
export function clearPreferences(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Leaving is more important than tidying. */
  }
  notify();
}

/** The theme and workspace to draw with, redrawn whenever they change. */
export function usePreferences(): EffectivePreferences {
  const raw = useSyncExternalStore(subscribePreferences, preferencesSnapshot, () => null);
  return useMemo(() => parsePreferences(raw), [raw]);
}

/**
 * Whether the signed-in person lands on the doctor's workspace at `/`.
 *
 * Two ways in, both the owner's: a role that is neither Owner nor
 * Administrator gets it by default, and any account can choose it in Můj
 * účet. An owner who chose it gets it too - the choice is theirs.
 */
export function opensDoctorWorkspace(role: string | null | undefined, workspace: WorkspaceKey): boolean {
  if (workspace === 'doctor') return true;
  return role !== 'Owner' && role !== 'Administrator';
}
