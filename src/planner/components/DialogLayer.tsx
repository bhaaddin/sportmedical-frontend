/*
 * DialogLayer - `#dialog-layer` (prototype `openDialog` / `closeDialog`): the single modal
 * layer of the stage. One dialog at a time (`state.dialog`); opening another replaces it,
 * exactly like the prototype.
 *
 * SHELL. Done: the layer, `DialogFrame` (scrim, card, header with title / subtitle / close,
 * body, footer - the prototype's markup and classes) and a titled frame for EVERY dialog kind
 * of `DialogState`, so each one can already be opened and closed.
 *
 * To implement a dialog, register its body in `dialogRegistry.ts` (one file per dialog under
 * `components/dialogs/`, not here):
 *
 *     dialogRegistry.orderDetails = ({ dialog, close }) => ({ body: <…/>, footer: <…/> });
 *
 * Prototype functions to port, by kind: orderDetails, settings, search, notifications, profile,
 * filterPicker, clubDetails / clubEdit (`openClubDetails`, `editClubDetails`), eventDetail
 * (`openEvent`), agendaDetail (`openAgendaDetail`), agendaFullList (`openAgendaFullList`),
 * deleteConfirm, newEvent (`newEventModal`), smartEdit (`smartEditTerm`), smartEditConfirm,
 * moveConfirm (`showTermMoveConfirm`), expandConfirm (`showTermExpansionConfirm`), finish
 * (`finishPlan`), publish (`adaptivePublishDialog`), formPreview, emailPreview, clubOccupancy.
 * The data of each is already computed by the model (`orderDetailsModel`, `agendaFullListModel`,
 * `smartEditViewModel`, `moveConfirmModel`, `expandConfirmModel`, `finishPlanModel`,
 * `publishModel`, `emailDraft`, `formPreviewRows`, `clubOccupancyModel` …).
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { DialogState } from '../model';
import { usePlannerActions, usePlannerSelector } from '../state/PlannerStoreProvider';
import { Icon } from './Icons';
import { usePlannerModelState } from './context';
import { dialogRegistry } from './dialogRegistry';
import './dialogs';

export interface DialogMeta {
  title: string;
  subtitle: string;
  wide: boolean;
}

/** Titles and subtitles of the prototype's dialogs (Czech). */
export function dialogMeta(dialog: DialogState, names: { clubName: string; clinicName: string }): DialogMeta {
  const club = names.clubName;
  switch (dialog.kind) {
    case 'orderDetails': return { title: 'Přehled existující objednávky', subtitle: `${club} · Přehled požadavků a plánování`, wide: true };
    case 'settings': return { title: 'Nastavení plánování', subtitle: 'Pravidla klubové objednávky', wide: false };
    case 'search': return { title: 'Vyhledat termín', subtitle: 'Vyhledávání podle činnosti, data nebo času', wide: true };
    case 'notifications': return { title: 'Upozornění', subtitle: 'Souhrn obsazenosti termínů', wide: false };
    case 'profile': return { title: 'Profil uživatele', subtitle: names.clinicName, wide: false };
    case 'filterPicker': return { title: 'Filtrovat činnosti', subtitle: 'Vyberte služby, které chcete zobrazovat', wide: false };
    case 'clubDetails': return { title: 'Údaje o klubu', subtitle: 'Adresa · Vedení klubu · Kontaktní osoba', wide: true };
    case 'clubEdit': return { title: 'Údaje o klubu', subtitle: `${club} · Vedení, kontakt a sídlo`, wide: true };
    case 'eventDetail': return { title: 'Detail termínu', subtitle: `${club} · ${names.clinicName}`, wide: false };
    case 'agendaDetail': return { title: 'Detail vytvořeného termínu', subtitle: 'SPRÁVA TERMÍNU', wide: true };
    case 'agendaFullList': return { title: 'Všechny vytvořené termíny', subtitle: 'Klubová objednávka', wide: true };
    case 'deleteConfirm': return { title: 'Zrušit termín?', subtitle: 'Odstranění termínu z rozvrhu', wide: false };
    case 'newEvent': return { title: 'Vytvořit termín', subtitle: 'Plánování existující klubové objednávky', wide: false };
    case 'smartEdit': return { title: 'Inteligentní úprava termínu', subtitle: 'Automatické trvání · bezpečné rezervace · potvrzení změny', wide: true };
    case 'smartEditConfirm': return { title: 'Potvrdit úpravu termínu?', subtitle: 'Původní → Nový · termín, činnost a návazné rezervace', wide: true };
    case 'moveConfirm': return { title: 'Opravdu přesunout termín?', subtitle: `Kontrola změny času a kapacity · ${club}`, wide: true };
    case 'expandConfirm': return { title: 'Opravdu rozšířit termín?', subtitle: `Kontrola nové kapacity a času · ${club}`, wide: true };
    case 'finish': return { title: 'Dokončení plánování', subtitle: `${club} · Kontrola objednávky`, wide: true };
    case 'publish': return { title: 'Připravit přihlašovací formulář', subtitle: `${club} · Náhled publikace objednávky`, wide: true };
    case 'formPreview': return { title: 'Náhled klubového formuláře', subtitle: 'Jak objednávku uvidí klub a jeho sportovci', wide: true };
    case 'emailPreview': return { title: 'E-mail pro klub', subtitle: 'Náhled zprávy, kterou klub obdrží po zveřejnění', wide: true };
    case 'clubOccupancy': return { title: 'Rezervace klubu', subtitle: 'Kompletní přehled naplňování termínů', wide: true };
  }
}

export interface DialogFrameProps {
  title: string;
  subtitle?: string;
  wide?: boolean;
  /** Extra class on the card (e.g. `smart-editor-modal`, `adaptive-publish-modal`). */
  className?: string;
  footer?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const FIRST_FIELD = '[data-autofocus],input:not([disabled]):not([type="hidden"]):not([type="file"]),select:not([disabled]),textarea:not([disabled]),[data-primary]';

/**
 * The prototype's modal markup: `.modal-scrim` + `section.modal-card` with header / body / footer.
 *
 * Keyboard: on opening, focus goes to the first field (`openDialog` focuses `input,select,
 * [data-primary]`), else the card itself; Tab and Shift+Tab stay inside the card; Esc is the
 * planner's global rule (`usePlannerKeyboard`). Focus returns to whatever opened the dialog when
 * the layer closes (see `DialogLayer`).
 */
export function DialogFrame({ title, subtitle, wide = false, className, footer, onClose, children }: DialogFrameProps) {
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(FIRST_FIELD) ?? el;
    target.focus({ preventScroll: true });
  }, []);

  const trap = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const el = card.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => !n.hidden);
    if (items.length === 0) {
      event.preventDefault();
      el.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (!el.contains(active) || active === el) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className="modal-scrim" data-close="1" onClick={onClose} />
      <section
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`modal-card${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`}
        data-testid="planner-dialog"
        onKeyDown={trap}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
          </div>
          <button className="modal-x" title="Zavřít" aria-label="Zavřít" data-close="1" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </section>
    </>
  );
}

export function DialogLayer() {
  const dialog = usePlannerSelector((s) => s.dialog);
  const act = usePlannerActions();
  const model = usePlannerModelState();
  const { profile, catalogue } = model;
  const close = () => act.closeDialog();

  /* Whoever opened the dialog gets the focus back when the layer closes. */
  const opener = useRef<HTMLElement | null>(null);
  const isOpen = dialog !== null;
  if (isOpen && opener.current === null && typeof document !== 'undefined') {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) opener.current = active;
  }
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const back = opener.current;
    opener.current = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
  }, [isOpen]);

  let content: ReactNode = null;
  let frameless = false;
  if (dialog) {
    const meta = dialogMeta(dialog, { clubName: profile?.clubName ?? '', clinicName: catalogue?.clinicName ?? '' });
    const render = dialogRegistry[dialog.kind] as
      | ((props: { dialog: DialogState; close: () => void; model: typeof model }) => { body?: ReactNode; footer?: ReactNode; className?: string; title?: string; subtitle?: string; frameless?: boolean })
      | undefined;
    const filled = render?.({ dialog, close, model });
    frameless = filled?.frameless === true;
    content = frameless ? (
      <>{filled?.body ?? null}</>
    ) : (
      <DialogFrame
        key={`${dialog.kind}:${'id' in dialog ? dialog.id : ''}`}
        title={filled?.title ?? meta.title}
        subtitle={filled?.subtitle ?? meta.subtitle}
        wide={meta.wide}
        className={filled?.className}
        footer={filled?.footer ?? <button className="app-button" data-close="1" onClick={close}>Zavřít</button>}
        onClose={close}
      >
        {filled?.body ?? null}
      </DialogFrame>
    );
  }
  return (
    <div id="dialog-layer" className={dialog && !frameless ? 'open' : undefined} aria-live="polite" data-testid="dialog-layer" data-dialog={dialog?.kind ?? ''}>
      {content}
    </div>
  );
}
