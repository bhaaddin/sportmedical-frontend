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
import type { ReactNode } from 'react';
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

/** The prototype's modal markup: `.modal-scrim` + `section.modal-card` with header / body / footer. */
export function DialogFrame({ title, subtitle, wide = false, className, footer, onClose, children }: DialogFrameProps) {
  return (
    <>
      <div className="modal-scrim" data-close="1" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={title} className={`modal-card${wide ? ' wide' : ''}${className ? ` ${className}` : ''}`} data-testid="planner-dialog">
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
  const { profile, catalogue } = usePlannerModelState();
  const close = () => act.closeDialog();
  let content: ReactNode = null;
  if (dialog) {
    const meta = dialogMeta(dialog, { clubName: profile?.clubName ?? '', clinicName: catalogue?.clinicName ?? '' });
    const render = dialogRegistry[dialog.kind] as ((props: { dialog: DialogState; close: () => void }) => { body?: ReactNode; footer?: ReactNode; className?: string; title?: string; subtitle?: string }) | undefined;
    const filled = render?.({ dialog, close });
    content = (
      <DialogFrame
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
    <div id="dialog-layer" className={dialog ? 'open' : undefined} aria-live="polite" data-testid="dialog-layer" data-dialog={dialog?.kind ?? ''}>
      {content}
    </div>
  );
}
