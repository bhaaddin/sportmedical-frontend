/* ══════════════════════════════════════════════════════════════
   WHICH ADDRESS STARTS WHICH READS

   When the page is opened straight on a calendar / club address (a reload, a bookmark, a link from the e-mail) the
   reference reads of that screen start NOW, while the screen's own code is still downloading, instead of after it has
   drawn once. That takes a round trip off a chain that is otherwise: code -> calendars -> previews / days / blocks.

   This file is on the application's first-load path (the query client imports it), so it stays tiny: the reads and the
   API clients they need are in warmReads.ts and are loaded only when an address asks for them.
   ══════════════════════════════════════════════════════════════ */
import type { QueryClient } from '@tanstack/react-query';

const CLUB_SCREEN = /^\/clubs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const CALENDAR_SCREEN = /^\/(planovani|dnes|prehled-sluzeb)(\/|$)/;
const CLUB_LIST = /^\/clubs\/?$/;

/** The window a club address's router state names (react-router keeps it under `usr`), if any. */
function blockIdOf(historyState: unknown): string | null {
  const usr = (historyState as { usr?: { clubBlockId?: unknown } } | null)?.usr;
  return typeof usr?.clubBlockId === 'string' ? usr.clubBlockId : null;
}

/**
 * Called once when the application loads. Only for a signed-in browser (a token is stored) opened on an address whose
 * screen is known to start from these reads; anything else starts nothing and loads nothing. A club address also
 * starts its account read, its screen's code and - once its orders are known - its stage's reads (see warmReads.ts).
 */
export function warmForPath(queryClient: QueryClient, pathname: string, search = '', historyState: unknown = null): void {
  let signedIn = false;
  try {
    signedIn = localStorage.getItem('token') !== null;
  } catch {
    signedIn = false;
  }
  if (!signedIn) return;

  const club = CLUB_SCREEN.exec(pathname);
  const list = CLUB_LIST.test(pathname);
  const calendar = CALENDAR_SCREEN.test(pathname);
  if (!club && !list && !calendar) return;

  void import('./warmReads')
    .then((reads) => {
      if (club) {
        reads.warmAccount();
        reads.prefetchClubScreen(queryClient, club[1], { orderId: new URLSearchParams(search).get('order'), blockId: blockIdOf(historyState) });
      }
      else if (list) reads.warmClubList(queryClient);
      else reads.warmReferenceData(queryClient);
    })
    .catch(() => undefined);
}
