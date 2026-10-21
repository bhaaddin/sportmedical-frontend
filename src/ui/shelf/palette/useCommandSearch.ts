/*
 * What the palette shows for what is typed.
 *
 * Instant: the actions, the pages, the settings screens (searchSettingsItems, the same ranking the settings rail has),
 * what is pinned and recent. Asked of the application's own api modules, once the query has two characters and has
 * rested 200 ms: patients (the server's search, cancelled when the next keystroke makes it stale), clubs, club orders,
 * invoices, services and the nearby appointments (each a list the other screens already cache, fetched once and
 * ranked here). A kind the person may not open is never asked for and never shown.
 *
 * Privacy: a query shaped like a birth number or a long run of digits is not sent to any endpoint (`serverSearchAllowed`);
 * nothing is logged; a failed source simply contributes nothing (the palette never fails as a whole).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../../api/billing';
import { calendarApi } from '../../../api/calendar';
import { clinicServicesApi } from '../../../api/clinicServices';
import { clubOrdersApi, ORDER_STATUS_LABEL } from '../../../api/clubOrders';
import { clubsApi } from '../../../api/clubs';
import { patientsApi } from '../../../api/patients';
import { usePermissions } from '../../../auth/usePermission';
import { formatCzk } from '../../../components/booking/grid/appointmentPrice';
import { searchSettingsItems, visibleSections } from '../../../pages/settings/catalogue';
import { addDaysToDateOnly, pragueDateKey } from '../../../utils/time';
import { PEEK_KEYS } from '../peek';
import { getMemory, getServerMemory, subscribeMemory } from '../memory';
import { mayOpen } from '../entities';
import {
  emptyView, entityCommand, flatten, rankCommands, sectionsOf, serverSearchAllowed, staticCommands,
  MIN_SERVER_QUERY, type Command, type CommandSection,
} from './commandModel';

export const DEBOUNCE_MS = 200;
/** How far around today the appointment search looks (days back, days ahead). */
const APPOINTMENT_WINDOW = { back: 14, ahead: 90 } as const;

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export interface CommandSearch {
  sections: CommandSection[];
  flat: Command[];
  busy: boolean;
  /** The text is too short to ask anything (the opening view is shown). */
  idle: boolean;
  /** The text looks like an identifier: nothing was sent anywhere. */
  withheld: boolean;
}

export function useCommandSearch(query: string, open: boolean): CommandSearch {
  const held = usePermissions();
  const queryClient = useQueryClient();
  const memory = useSyncExternalStore(subscribeMemory, getMemory, getServerMemory);
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const [remote, setRemote] = useState<{ for: string; commands: Command[] }>({ for: '', commands: [] });
  const [busy, setBusy] = useState(false);

  const idle = query.trim().length < MIN_SERVER_QUERY;
  const withheld = !idle && !serverSearchAllowed(query);

  useEffect(() => {
    if (!open || debounced.length < MIN_SERVER_QUERY) {
      setRemote({ for: '', commands: [] });
      setBusy(false);
      return undefined;
    }
    const controller = new AbortController();
    let live = true;
    setBusy(true);
    const MINUTE = 60_000;
    const ask = <T,>(run: () => Promise<T[]>, map: (rows: T[]) => Command[]): Promise<Command[]> =>
      run().then(map).catch(() => [] as Command[]);

    const jobs: Promise<Command[]>[] = [];
    if (mayOpen('patient', held) && serverSearchAllowed(debounced)) {
      jobs.push(
        ask(
          () => patientsApi.search(debounced, { signal: controller.signal }),
          (rows) => rows.slice(0, 8).map((p) => entityCommand({ kind: 'patient', id: p.id, label: `${p.firstName} ${p.lastName}`.trim() }, p.dateOfBirth ? `nar. ${p.dateOfBirth.slice(0, 4)}` : undefined)),
        ),
      );
    }
    jobs.push(
      ask(() => queryClient.fetchQuery({ queryKey: ['shelf', 'clubs'], queryFn: () => clubsApi.getAll(), staleTime: 5 * MINUTE }), (rows) =>
        rows.map((c) => entityCommand({ kind: 'club', id: c.id, label: c.name }, [c.city, c.isActive ? null : 'neaktivní'].filter(Boolean).join(' · ') || undefined)),
      ),
      ask(() => queryClient.fetchQuery({ queryKey: ['shelf', 'club-orders', 'all'], queryFn: () => clubOrdersApi.list({}), staleTime: MINUTE }), (rows) =>
        rows.map((o) => entityCommand({ kind: 'order', id: o.id, label: [o.clubName, o.serviceName].filter(Boolean).join(' · ') }, ORDER_STATUS_LABEL[o.status])),
      ),
    );
    if (mayOpen('invoice', held)) {
      jobs.push(
        ask(() => queryClient.fetchQuery({ queryKey: PEEK_KEYS.invoices, queryFn: () => billingApi.getInvoices(), staleTime: MINUTE }), (rows) =>
          rows.map((i) => entityCommand({ kind: 'invoice', id: i.id, label: i.invoiceNumber }, [i.clubName ?? i.recipientName ?? i.patientName, formatCzk(i.totalCzk)].filter(Boolean).join(' · '))),
        ),
      );
    }
    if (mayOpen('service', held)) {
      jobs.push(
        ask(() => queryClient.fetchQuery({ queryKey: PEEK_KEYS.services, queryFn: () => clinicServicesApi.list(), staleTime: 5 * MINUTE }), (rows) =>
          rows.map((s) => entityCommand({ kind: 'service', id: s.id, label: s.name }, `${s.activities} činností`)),
        ),
      );
    }
    /* The nearby appointments, cancelled ones left out (a result must never offer a slot that is gone). */
    const today = pragueDateKey(new Date());
    const from = addDaysToDateOnly(today, -APPOINTMENT_WINDOW.back);
    const to = addDaysToDateOnly(today, APPOINTMENT_WINDOW.ahead);
    jobs.push(
      ask(() => queryClient.fetchQuery({ queryKey: ['shelf', 'appointments', from, to], queryFn: () => calendarApi.getAppointments(from, to), staleTime: MINUTE }), (rows) =>
        rows
          .filter((a) => a.status !== 'Cancelled')
          .map<Command>((a) => {
            const day = pragueDateKey(a.startTime);
            return {
              id: `appointment-${a.id}`,
              group: 'appointment',
              label: [a.patientName, a.serviceType].filter(Boolean).join(' · ') || 'Termín',
              hint: `${new Date(a.startTime).toLocaleDateString('cs-CZ')}${a.practitionerName ? ` · ${a.practitionerName}` : ''}`,
              to: '/planovani',
              state: { date: day },
              entity: { kind: 'appointment', id: a.id, label: a.patientName || a.serviceType || 'Termín' },
            };
          }),
      ),
    );

    void Promise.all(jobs).then((parts) => {
      if (!live) return;
      setRemote({ for: debounced, commands: parts.flat() });
      setBusy(false);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [open, debounced, held, queryClient]);

  const statics = useMemo(() => staticCommands(held), [held]);
  const settings = useMemo<Command[]>(() => {
    if (idle) return [];
    /* The catalogue narrows to the screens this person may open (and to the words typed); the generic ranking then orders them
       with everything else, using the catalogue's own keywords. */
    return searchSettingsItems(visibleSections(held), query)
      .slice(0, 12)
      .map((hit) => ({
        id: `settings-${hit.section.id}-${hit.item.id}`,
        group: 'settings' as const,
        label: hit.item.label,
        hint: `${hit.section.label} · ${hit.item.description}`,
        keywords: hit.item.keywords,
        to: hit.item.to,
      }));
  }, [held, idle, query]);

  return useMemo(() => {
    if (idle) {
      const sections = emptyView(held, memory);
      return { sections, flat: flatten(sections), busy: false, idle: true, withheld: false };
    }
    /* Remote rows belong to the text they were asked for; while a newer text is still being asked the older rows are kept
       (they are only re-ranked against what is typed now), so the list does not flash empty between keystrokes. */
    const sections = sectionsOf(rankCommands(query, [...statics, ...settings, ...remote.commands], memory));
    return { sections, flat: flatten(sections), busy, idle: false, withheld };
  }, [idle, held, memory, statics, settings, remote.commands, query, busy, withheld]);
}
