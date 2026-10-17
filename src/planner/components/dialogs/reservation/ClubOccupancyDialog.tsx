/*
 * "Rezervace klubu" (prototype `openClubOccupancyOverview`): the club's terms with their fill, chronological,
 * opened from the reservation drawer's "Rozhraní klubu". Figures come from `clubOccupancyModel`; a row opens
 * the term's detail, the footer goes back to the day's drawer or on to the club's data.
 */
import type { CSSProperties } from 'react';
import { clubOccupancyModel, type IsoDate, printable, dateOf } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';

const css = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

/** "FK Slaný" -> "FK" (a short capitalised first word is the club's own abbreviation); else the first letters of two words. */
export function clubMonogram(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  if (first.length >= 2 && first.length <= 3 && first === first.toLocaleUpperCase('cs-CZ')) return first;
  const letters = words
    .slice(0, 2)
    .map((word) => [...word][0]!.toLocaleUpperCase('cs-CZ'));
  return letters.join('') || '—';
}

function ClubOccupancyBody({ focusDate }: { focusDate: IsoDate }) {
  const ctx = usePlannerCtx();
  const { profile, catalogue } = usePlannerModelState();
  const act = usePlannerActions();
  const demo = !!catalogue?.capabilities.simulateBookings;
  const days = catalogue?.releaseDaysBefore;
  const m = clubOccupancyModel(ctx, { clubName: profile?.clubName ?? '' }, focusDate, days);
  return (
    <div data-testid="club-occupancy">
      <div className="club-app-banner">
        <div className="club-app-monogram">{clubMonogram(m.clubName)}</div>
        <div>
          <small>MONITORING REZERVACÍ SPORTOVNÍHO KLUBU{demo ? ' · DEMO' : ''}</small>
          <h3>{m.clubName}</h3>
          <p>
            Naplnění konkrétních termínů ·{' '}
            {catalogue?.releaseNever ? 'neobsazená místa se automaticky neuvolňují.' : `automatické uvolnění neobsazených míst ${days ?? 7} dní před termínem.`}
          </p>
        </div>
      </div>
      <div className="club-app-kpis">
        <div><small>Potvrzeno klubem</small><b>{m.totals.club}</b><span>z {m.totals.capacity} klubových slotů</span></div>
        <div><small>Rezervace jednotlivců</small><b>{m.totals.publicCount}</b><span>na uvolněných místech</span></div>
        <div><small>Drženo pro klub</small><b>{m.totals.held}</b><span>přednostní blokace</span></div>
        <div><small>Vytvořené termíny</small><b>{m.termCount}</b><span>v aktuální objednávce</span></div>
      </div>
      <div className="club-app-list-title">TERMÍNY A REALIZACE <span>kliknutím otevřete konkrétní termín</span></div>
      <div className="club-app-list">
        {m.rows.length === 0 ? (
          <div className="rd-empty">Pro tento klub zatím nejsou vytvořené termíny.</div>
        ) : (
          m.rows.map((row) => (
            <button
              type="button"
              key={row.id}
              className={`club-app-row${row.focused ? ' is-focused' : ''}`}
              data-club-monitor-term={row.id}
              onClick={() => act.openDialog({ kind: 'agendaDetail', id: row.id })}
            >
              <span className="club-app-color" style={css({ '--tone': row.tone })} />
              <span className="club-app-date"><b>{row.dateLabel}</b><small>{row.timeRange}</small></span>
              <span className="club-app-service"><strong>{row.name}</strong><small>{row.note}</small></span>
              <span className="club-app-numbers"><b>{row.clubLabel}</b><small>klub potvrzen</small></span>
              <span className="club-app-mini-progress" style={css({ '--width': `${row.progressPercent}%`, '--tone': row.tone })}><i /></span>
              <span className="club-app-chevron">→</span>
            </button>
          ))
        )}
      </div>
      {demo ? <div className="rd-note">Tento přehled je součástí offline simulace. V provozu se otevře skutečné klubové rozhraní nad společnou databází, ne nezávislá kopie údajů.</div> : null}
    </div>
  );
}

function ClubOccupancyFooter({ focusDate }: { focusDate: IsoDate }) {
  const act = usePlannerActions();
  return (
    <>
      <button type="button" className="app-button" id="club-app-back-date" onClick={() => { act.closeDialog(); act.openReservationDrawer(focusDate); }}>
        ← Detail dne {printable(dateOf(focusDate))}
      </button>
      <button type="button" className="app-button primary" id="club-app-show-profile" onClick={() => act.openDialog({ kind: 'clubDetails' })}>
        Údaje klubu →
      </button>
    </>
  );
}

export const clubOccupancyDialog: DialogRenderer<'clubOccupancy'> = ({ dialog }) => ({
  body: <ClubOccupancyBody focusDate={dialog.focusDate} />,
  footer: <ClubOccupancyFooter focusDate={dialog.focusDate} />,
});
