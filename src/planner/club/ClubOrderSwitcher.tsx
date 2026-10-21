/*
 * ClubOrderSwitcher - which of the club's orders the stage shows ("Objednávka KO-… ▾"), in the board toolbar where the
 * standard calendar has its "Objednávka / Klub" buttons.
 *
 * A club has several orders; the groups (a root with its addenda) are listed with code, služba(s), players and status,
 * then "Nová objednávka klubu" (the existing chooser) and "Přehled klubu a objednávek" (the order overview dialog,
 * which carries every action of the old club page). Choosing a group puts it on the stage (`?order=`); only the
 * Confirmed ones are editable there, the rest open for reading (the deck says why).
 *
 * Drawn from the prototype's own controls: the button is `.control` (toolbar), the list copies `.filter-select` (panel,
 * border, option colours) and `.view-segment` (hover, active gradient) - see club.css.
 */
import { useEffect, useRef, useState } from 'react';
import { ORDER_STATUS_LABEL } from '../../api/clubOrders';
import { windowDates } from '../../components/clubs/orders/orderWindows';
import { useOptionalPlannerModel } from '../components/context';
import { Icon } from '../components/Icons';
import { usePlannerActions } from '../state/PlannerStoreProvider';
import { groupPlayers, groupServices, type ClubGroup } from './clubGroups';
import { useClubPlanner, type ClubPlannerValue } from './ClubPlannerContext';
import './club.css';

/**
 * What the switcher reads. A new order on the stage (`adhoc: 'new'`) is "Nová objednávka" only until it is saved: the
 * data source then holds the saved order (`savedCode`) and the label says so at once, without a reload.
 */
export function switcherLabel(input: { adhoc: 'new' | 'edit' | null; selectedCode: string | null; savedCode: string | null }): string {
  if (input.adhoc === 'new') return input.savedCode ? `Objednávka ${input.savedCode}` : 'Nová objednávka';
  return input.selectedCode !== null ? `Objednávka ${input.selectedCode}` : 'Žádná objednávka';
}

const groupWhen = (g: ClubGroup): string => (g.firstDate === null ? 'bez termínů' : windowDates(g.firstDate, g.lastDate ?? g.firstDate));

/** Nothing off a club's screen (and no planner store needed there: the board toolbar is also drawn on its own in tests). */
export function ClubOrderSwitcher() {
  const club = useClubPlanner();
  return club === null ? null : <Switcher club={club} />;
}

function Switcher({ club }: { club: ClubPlannerValue }) {
  const act = usePlannerActions();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLElement>('button')?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const { groups, selected, adhoc } = club;
  const savedCode = useOptionalPlannerModel()?.order?.code ?? null;
  const label = switcherLabel({ adhoc, selectedCode: selected?.code ?? null, savedCode });
  const draftSaved = adhoc === 'new' && savedCode !== null;

  return (
    <div className="planner-actions club-switch" ref={root} data-testid="club-order-switcher">
      <button
        type="button"
        className="control"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Objednávka klubu: ${label}`}
        data-testid="club-order-switch-button"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="users" />
        <span>{label}</span>
        <Icon name="chevron-down" />
      </button>
      {open ? (
        <div className="club-switch-menu" role="menu" aria-label="Objednávky klubu" data-testid="club-order-menu">
          {adhoc === 'new' ? (
            <button type="button" role="menuitemradio" aria-checked="true" className="club-switch-item is-active" data-testid="club-order-new-draft" onClick={() => setOpen(false)}>
              <b>{draftSaved ? `Objednávka ${savedCode} (uložená)` : 'Nová objednávka (rozpracovaná)'}</b>
              <small>{club.club.name} · {draftSaved ? 'uložena, na plátně' : 'ještě nevytvořena'}</small>
            </button>
          ) : null}
          {groups.length === 0 && adhoc !== 'new' ? <div className="club-switch-empty">Klub zatím nemá žádnou objednávku.</div> : null}
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              role="menuitemradio"
              aria-checked={adhoc === null && selected?.id === g.id}
              className={`club-switch-item${adhoc === null && selected?.id === g.id ? ' is-active' : ''}`}
              data-testid="club-order-option"
              data-group-id={g.id}
              data-editable={g.editable ? 'true' : 'false'}
              onClick={() => { setOpen(false); club.select(g.id); }}
            >
              <b>{g.code} · {groupServices(g)}</b>
              <small>{groupPlayers(g)} · {ORDER_STATUS_LABEL[g.root.status]} · {groupWhen(g)}{g.addenda.length > 0 ? ` · +${g.addenda.length} dodatek` : ''}</small>
            </button>
          ))}
          <div className="club-switch-rule" />
          {club.planning ? (
            <button type="button" role="menuitem" className="club-switch-item" data-testid="club-order-leave-planning" onClick={() => { setOpen(false); club.leavePlanning(); }}>
              <b>Přehled klubu</b>
              <small>Ukončit plánování a vrátit se na klub</small>
            </button>
          ) : null}
          <button type="button" role="menuitem" className="club-switch-item" data-testid="club-order-new" onClick={() => { setOpen(false); club.newOrder(); }}>
            <b>Nová objednávka klubu</b>
          </button>
          <button type="button" role="menuitem" className="club-switch-item" data-testid="club-order-overview" onClick={() => { setOpen(false); act.openDialog({ kind: 'orderDetails' }); }}>
            <b>Přehled klubu a objednávek</b>
          </button>
        </div>
      ) : null}
    </div>
  );
}
