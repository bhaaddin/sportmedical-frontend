/* ══════════════════════════════════════════════════════════════
   THE READS A SCREEN WILL NEED, STARTED BEFORE THE SCREEN IS THERE

   (The decision which address starts which of these is in warmStart.ts, which is
   deliberately tiny: this file pulls in the API clients and is loaded on demand.)

   A screen cannot ask for anything until its code has arrived and drawn once,
   and its first reads (the calendars) decide what the next ones are (one per
   calendar). Two cheap moves take whole round trips off that chain:

     - when the page is opened straight on a calendar / club address (a
       reload, a bookmark, a link from the e-mail), the reference reads start
       NOW, while the screen's code is still downloading;
     - on the club list, a card the pointer rests on (or that gets focus)
       starts the reads of its own screen, so the click finds them.

   Both use the SAME query keys and read functions as the screens, so what is
   fetched here is exactly what the screen would ask for: nothing twice, and
   whatever is still fresh is not fetched (the client's staleness tiers
   decide). A failure is dropped; the screen asks again when it opens.
   ══════════════════════════════════════════════════════════════ */
import type { QueryClient } from '@tanstack/react-query';
import { activitiesApi } from './activities';
import { calendarsApi } from './calendars';
import { readPublicClinic } from './clinicSettings';
import { clinicServicesApi } from './clinicServices';
import { clubBlocksApi } from './clubBlocks';
import { clubOrdersApi } from './clubOrders';
import { CLUB_SETTINGS_QUERY_KEY, clubSettingsApi, clubsApi } from './clubs';
import { CALENDAR_DISPLAY_QUERY_KEY, readCalendarDisplay } from './displaySettings';
import { holidaysApi } from './holidays';

/** How long the pointer rests on a card before it counts as an intention to open it. */
export const HOVER_INTENT_MS = 200;

const warm = (promise: Promise<unknown>): void => void promise.catch(() => undefined);

/** What every calendar screen (the planner, a club's planner) starts from. */
export function warmReferenceData(queryClient: QueryClient, year = new Date().getFullYear()): void {
  warm(queryClient.prefetchQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list }));
  warm(queryClient.prefetchQuery({ queryKey: ['activities'], queryFn: () => activitiesApi.list() }));
  warm(queryClient.prefetchQuery({ queryKey: ['clinic-services'], queryFn: clinicServicesApi.list }));
  warm(queryClient.prefetchQuery({ queryKey: CALENDAR_DISPLAY_QUERY_KEY, queryFn: readCalendarDisplay }));
  warm(queryClient.prefetchQuery({ queryKey: CLUB_SETTINGS_QUERY_KEY, queryFn: clubSettingsApi.get }));
  warm(queryClient.prefetchQuery({ queryKey: ['public-clinic'], queryFn: readPublicClinic }));
  warm(queryClient.prefetchQuery({ queryKey: ['holidays', year], queryFn: () => holidaysApi.year(year) }));
}

/** The reads of a club's own screen (`/clubs/:clubId`), see `useClubPlannerData`. */
export function prefetchClubScreen(queryClient: QueryClient, clubId: string, year?: number): void {
  warm(queryClient.prefetchQuery({ queryKey: ['clubs', 'one', clubId], queryFn: () => clubsApi.getById(clubId) }));
  warm(queryClient.prefetchQuery({ queryKey: ['club-orders', clubId, '', ''], queryFn: () => clubOrdersApi.list({ clubId }) }));
  warm(queryClient.prefetchQuery({ queryKey: ['club-blocks', 'list'], queryFn: () => clubBlocksApi.list() }));
  warmReferenceData(queryClient, year);
}

/** The reads of the club list: the clubs, their blocks and orders, and the calendars the older reservations hang on. */
export function warmClubList(queryClient: QueryClient): void {
  warm(
    queryClient.prefetchQuery({
      queryKey: ['clubs'],
      queryFn: async () => {
        const list = await clubsApi.getAll(false);
        return Array.isArray(list) ? list : [];
      },
    }),
  );
  warm(queryClient.prefetchQuery({ queryKey: ['club-blocks', 'list'], queryFn: () => clubBlocksApi.list() }));
  warm(queryClient.prefetchQuery({ queryKey: ['club-orders', '', '', ''], queryFn: () => clubOrdersApi.list({}) }));
  warm(queryClient.prefetchQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list }));
}

