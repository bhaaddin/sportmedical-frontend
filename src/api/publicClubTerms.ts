/* ══════════════════════════════════════════════════════════════
   PUBLIC CLUB TERMS

   GET /api/public/club-terms (anonymous, contract C-C) -> { minimumPlayers: number | null }

   `minimumPlayers` is the clinic's own setting (Nastavení > Kluby). null means
   "no minimum": the public Kluby page then says nothing about one. There is no
   number in code - on a failure, a missing endpoint or an unreadable answer this
   module returns null, never a figure of its own, and the initial data is null
   too, so a prerendered page shows nothing until the real answer arrives.

   Usage on the page:
     const { data } = useClubTerms();
     const minimum = data?.minimumPlayers ?? null;
     {minimum !== null ? <p>Minimálně {minimum} sportovců…</p> : null}

   Accepted shapes: { minimumPlayers }, optionally in the { success, data } envelope.
   ══════════════════════════════════════════════════════════════ */

import { useQuery } from '@tanstack/react-query';
import { unwrapEnvelope, webHttp } from '../web/http';

export interface ClubTerms {
  minimumPlayers: number | null;
}

export const CLUB_TERMS_KEY = ['web', 'club-terms'] as const;

export const NO_CLUB_TERMS: ClubTerms = { minimumPlayers: null };

export function normalizeClubTerms(raw: unknown): ClubTerms {
  const body = unwrapEnvelope(raw);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return NO_CLUB_TERMS;
  const { minimumPlayers } = body as { minimumPlayers?: unknown };
  return typeof minimumPlayers === 'number' && Number.isFinite(minimumPlayers) && minimumPlayers >= 1
    ? { minimumPlayers }
    : NO_CLUB_TERMS;
}

/** `{ minimumPlayers: null }` when the endpoint is missing, refuses or is unreachable. */
export async function fetchClubTerms(): Promise<ClubTerms> {
  try {
    const { data } = await webHttp.get<unknown>('/api/public/club-terms');
    return normalizeClubTerms(data);
  } catch {
    return NO_CLUB_TERMS;
  }
}

export function useClubTerms() {
  return useQuery<ClubTerms>({
    queryKey: CLUB_TERMS_KEY,
    queryFn: fetchClubTerms,
    initialData: () => NO_CLUB_TERMS,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
