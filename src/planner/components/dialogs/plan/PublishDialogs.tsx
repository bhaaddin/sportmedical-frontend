/*
 * `publish`, `formPreview`, `emailPreview` - "Připravit přihlašovací formulář" (prototype `adaptivePublishDialog`,
 * `adaptiveClubFormPreview`, `adaptiveEmailPreview`, `adaptiveEmailDraft`), bound to the real invitation:
 *
 *   Vygenerovat / Obnovit odkaz   `publishForm()` - the private link of the club's order form (the source invites the club)
 *   Kopírovat odkaz               the link to the clipboard
 *   Kopírovat text e-mailu        the e-mail draft (with the link) to the clipboard
 *   Náhled formuláře              the club's terms as the club sees them (nothing is booked from the preview)
 *   Náhled e-mailu                the text the club would get
 *
 * NOTHING is e-mailed from here: there is no sending - the desk copies the link / the text and sends it. The
 * numbers are the order's own counter (plan/orderFigures.ts).
 */
import { useEffect, useState } from 'react';
import { usePlannerData } from '../../../data/PlannerDataProvider';
import { PLANNER_TEXT } from '../../../text';
import { usePlannerCommands } from '../../../data/usePlannerCommands';
import { dateOf, printable, timeLeft } from '../../../model';
import { usePlannerActions, usePlannerSelector } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx, usePlannerModelState, usePlannerProfile } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';
import type { OrderFigures } from '../../plan/orderFigures';
import { orderTerms } from '../../plan/orderFigures';
import { usePlanFigures } from '../../plan/usePlanFigures';
import { writeMessage } from '../../plan/usePlanCommit';
import { absoluteLink, usePublicSiteBase } from '../../../../components/clubs/orders/absoluteLink';
import { CopyButton } from '../../../../components/clubs/orders/CopyButton';
import { publishSteps } from '../../../guide/advice';
import '../../../guide/guide.base.css';
import { createFlowStore, useFlow } from './flowStore';
import { useCopy } from './shared';

/** The link generated in this session (survives going to a preview and back). */
const published = createFlowStore<{ url: string | null; generated: boolean; busy: boolean; owner: object | null; previewed: boolean; copied: boolean }>({ url: null, generated: false, busy: false, owner: null, previewed: false, copied: false });

export const LINK_PLACEHOLDER = '[ODKAZ ZATÍM NEBYL VYGENEROVÁN - nejdřív ho vygenerujte v „Připravit formulář“]';

/** The plain-text e-mail the club gets: the order's numbers, the link, the clinic's name (a setting). */
export function emailText(figures: Pick<OrderFigures, 'requested' | 'planned'>, clubName: string, clinicName: string, link: string | null): { subject: string; body: string } {
  return {
    subject: `${clinicName} · Termíny vyšetření pro ${clubName}`,
    body: `Dobrý den,\n\npřipravili jsme pro ${clubName} termíny sportovních vyšetření.\n\nV klubovém objednávkovém formuláři můžete vybrat termín pro jednotlivé sportovce.\n\nPočet požadovaných osob: ${figures.requested}\nAktuálně naplánováno: ${figures.planned}\n\nOdkaz na objednávkový formulář:\n${link ?? LINK_PLACEHOLDER}\n\nVyplnění je určeno pouze členům vašeho klubu. Nepotvrzené blokace budou podle nastavených podmínek uvolněny veřejnosti před termínem.\n\nS pozdravem\n${clinicName}`,
  };
}

/** What was generated in THIS planner (a store left over from another source instance counts for nothing). */
function usePublished(): { url: string | null; generated: boolean; busy: boolean; previewed: boolean; copied: boolean } {
  const { source } = usePlannerData();
  const state = useFlow(published);
  return state.owner === source ? state : { url: null, generated: false, busy: false, previewed: false, copied: false };
}

/**
 * The club's link as it is shown, copied and written into the e-mail: the FULL address (the admin-set public
 * address, else this app's origin) + the route the server's token belongs to (`/klub-objednavka/:token`) - the
 * same helper the order panel uses. The server may hand out a bare path; it is never shown as one.
 */
function useLink(): string | null {
  const { order } = usePlannerModelState();
  const state = usePublished();
  const base = usePublicSiteBase();
  const raw = state.url ?? order?.linkUrl ?? null;
  const full = absoluteLink(raw, base);
  return full === '' ? null : full;
}

function PublishBody() {
  const { base: x } = usePlanFigures();
  const profile = usePlannerProfile();
  const generatedFlag = usePlannerSelector((s) => s.formGenerated);
  const state = usePublished();
  const link = useLink();
  const generated = generatedFlag || state.generated || link !== null;
  return (
    <div className="pub-shell">
      <section className="pub-card">
        <div className="pub-kicker">01 / KONTROLA KLUBOVÉ OBJEDNÁVKY</div>
        <div className="pub-progress">{x.planned} <span>/ {x.requested} osob</span></div>
        <div className="pub-sub">Naplánovaná kapacita z již vytvořené poptávky · {x.percent}% připraveno</div>
        <div className="pub-bar"><div style={{ width: `${x.percent}%` }} /></div>
        <div className="pub-activities">
          {x.list.map((f) => (
            <div className="pub-activity" key={f.categoryId}>
              <span style={{ color: f.color }}>{f.name}</span>
              <b>{f.planned} / {f.requested}</b>
              <small>{timeLeft(f.remainingMinutes)}</small>
            </div>
          ))}
        </div>
        {x.remaining > 0 ? (
          <div className="pub-warning">Zbývá naplánovat {x.remaining} osob ({timeLeft(x.remainingMinutes)}). Můžete si prohlédnout formulář a připravit koncept, ale úplná objednávka ještě není rozplánována.</div>
        ) : (
          <div className="pub-blueprint"><i>✓</i> Všechny požadované kapacity jsou naplánované.</div>
        )}
        <div className="pub-blueprint"><i>✓</i> Termíny se synchronizují z jediného společného kalendáře.</div>
      </section>
      <PublishSide profileEmail={profile.contactEmail} generated={generated} link={link} figures={x} />
    </div>
  );
}

function PublishSide({ profileEmail, generated, link, figures }: { profileEmail: string; generated: boolean; link: string | null; figures: OrderFigures }) {
  const act = usePlannerActions();
  const commands = usePlannerCommands();
  const copy = useCopy();
  const profile = usePlannerProfile();
  const { catalogue } = usePlannerModelState();
  const { source } = usePlannerData();
  const state = usePublished();
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    /* A new link: the preview and the copy of the old one count for nothing. */
    published.set({ busy: true, owner: source, previewed: false, copied: false });
    setError(null);
    try {
      const result = await commands.publishForm();
      published.set({ url: result.url ?? (published.get().owner === source ? published.get().url : null), generated: result.generated, busy: false, owner: source, previewed: false, copied: false });
      act.setFormGenerated(result.generated);
      act.toast(result.url ? 'Odkaz pro klub je připravený.' : 'Odkaz zatím nevzniká: tento zdroj dat jen ukazuje náhled. Nic nebylo odesláno.');
    } catch (e) {
      published.set({ busy: false });
      setError(writeMessage(e, 'Odkaz pro klub se nepodařilo vytvořit.'));
    }
  };
  const mail = emailText(figures, profile.clubName, catalogue?.clinicName ?? '', link);
  const progress = publishSteps({ generated: link !== null, previewed: state.previewed, copied: state.copied });
  const [one, two, three] = progress.steps;
  const markCopied = (ok: boolean) => { if (ok) published.set({ copied: true, owner: source }); };
  const copyThen = async (text: string, done: string, blocked?: string) => { markCopied(await copy(text, done, blocked)); };

  return (
    <section className="pub-card">
      <div className="pub-kicker">02 / VYGENEROVÁNÍ A PUBLIKACE</div>
      <div className="pub-side-heading">Klubový přihlašovací formulář</div>
      <ol className="pub-steps" aria-label={PLANNER_TEXT.guide.steps.title} data-testid="publish-steps">
        {progress.steps.map((st) => (
          <li key={st.n} className={`pub-step is-${st.state}`} data-step={st.n} data-state={st.state} aria-current={st.state === 'current' ? 'step' : undefined}>
            <span className="pub-step-n" aria-hidden="true">{st.state === 'done' ? '✓' : st.n}</span>
            <span className="pub-step-title">{st.title}</span>
            <span className="pub-step-state">{PLANNER_TEXT.guide.steps.state[st.state]}</span>
          </li>
        ))}
      </ol>
      <p className="pub-say" data-testid="publish-say" role="status">{progress.say}</p>
      <div className="pub-link-row">
        <div className="pub-link" id="adaptive-link-label" data-testid="publish-link" data-url={link ?? ''}>
          {link ?? (generated ? 'ODKAZ ZATÍM NEVZNIKÁ · ukázkový zdroj dat' : 'Odkaz zatím nevygenerován')}
        </div>
        <CopyButton text={link ?? ''} ariaLabel="Zkopírovat odkaz pro klub" testId="publish-link-copy" onCopied={markCopied} />
      </div>
      <div className="pub-actions pub-steps-actions">
        <div className="pub-step-action">
          <button type="button" className={`${one.state === 'current' ? 'primary ' : ''}pub-go`} id="pub-generate" disabled={state.busy} onClick={() => void generate()}>
            <b aria-hidden="true">1</b> {generated ? 'Obnovit odkaz' : 'Vygenerovat odkaz'}
          </button>
        </div>
        <div className="pub-step-action">
          <button type="button" className={`${two.state === 'current' ? 'primary ' : ''}pub-go`} id="pub-see-email" disabled={two.state === 'locked'} aria-describedby={two.reason ? 'pub-why-2' : undefined} onClick={() => act.openDialog({ kind: 'emailPreview' })}>
            <b aria-hidden="true">2</b> Náhled e-mailu
          </button>
          {two.reason ? <small id="pub-why-2" className="pub-why" data-testid="publish-why-2">{two.reason}</small> : null}
        </div>
      </div>
      <div className="pub-side-desc" style={{ marginTop: 11 }}>Příjemce: <b>{profileEmail || 'e-mail kontaktu nebyl vyplněn'}</b></div>
      <div className="pub-actions pub-steps-actions">
        <div className="pub-step-action">
          <button type="button" className={`${three.state === 'current' ? 'primary ' : ''}pub-go`} id="pub-copy" disabled={three.state === 'locked' || link === null} aria-describedby={three.reason ? 'pub-why-3' : undefined} onClick={() => link && void copyThen(link, 'Odkaz zkopírován.')}>
            <b aria-hidden="true">3</b> Kopírovat odkaz
          </button>
          <button type="button" id="pub-copy-email" disabled={three.state === 'locked'} aria-describedby={three.reason ? 'pub-why-3' : undefined} onClick={() => void copyThen(`${mail.subject}\n\n${mail.body}`, link ? 'Text e-mailu zkopírován.' : 'Text e-mailu zkopírován - odkaz v něm zatím chybí.', 'Nepodařilo se zkopírovat; označte text ručně.')}>Kopírovat text e-mailu</button>
          {three.reason ? <small id="pub-why-3" className="pub-why" data-testid="publish-why-3">{three.reason}</small> : null}
        </div>
      </div>
      <div className="pub-actions pub-extras">
        <button type="button" id="pub-see-form" onClick={() => act.openDialog({ kind: 'formPreview' })}>Náhled formuláře</button>
        <button type="button" id="pub-edit-contact" onClick={() => act.openDialog({ kind: 'clubEdit' })}>Upravit kontakt</button>
      </div>
      {error ? <p className="plan-dialog-error" role="alert">{error}</p> : null}
      <p className="pub-note"><strong>NIC SE NEODESÍLÁ.</strong> Plánovač neposílá e-maily: odkaz a text e-mailu zkopírujete a klubu je pošlete sami. Odkaz je soukromý a patří jen tomuto klubu.</p>
    </section>
  );
}

export const publishDialog: DialogRenderer<'publish'> = ({ close, model }) => ({
  body: <PublishBody />,
  footer: <button type="button" className="app-button" data-close="1" onClick={close}>Zpět do plánovače</button>,
  className: 'adaptive-publish-modal',
  subtitle: `${model.profile?.clubName ?? ''} · Náhled publikace objednávky`,
});

/* ------------------------------ form preview ------------------------------ */

function FormPreviewBody() {
  const ctx = usePlannerCtx();
  const profile = usePlannerProfile();
  const { order } = usePlannerModelState();
  const act = usePlannerActions();
  const terms = orderTerms(ctx, order?.id).slice().sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const nameOf = (id: string) => ctx.categories.find((c) => c.id === id)?.name ?? id;
  return (
    <>
      <div className="pub-kicker">UKÁZKA ROZHRANÍ PRO KLUB</div>
      <div className="pub-side-heading" style={{ fontSize: 24 }}>{profile.clubName}</div>
      <p className="pub-side-desc">Vyberte si požadované vyšetření a volný termín. Toto je pouze návrh veřejné stránky — data se nezapisují.</p>
      <div style={{ marginTop: 15, maxHeight: 390, overflow: 'auto' }}>
        {terms.length ? terms.map((e) => (
          <div className="pub-form-row" key={e.id}>
            <div><strong>{nameOf(e.categoryId)}</strong><br /><small>{printable(dateOf(e.date))} {e.start}–{e.end} · {e.capacity} míst · ukázka</small></div>
            <button type="button" data-preview-book={e.id} onClick={() => act.toast('Ukázka výběru. Bez změny skutečných rezervací.')}>Vybrat termín</button>
          </div>
        )) : <p>Na klubovou objednávku zatím nejsou vytvořeny žádné termíny.</p>}
      </div>
      <p className="pub-note">Po skutečném zveřejnění se zobrazí jednotlivé rezervovatelné časové sloty, klubové limity, ochrana před dvojí rezervací a pravidlo uvolnění neobsazených míst.</p>
    </>
  );
}

export const formPreviewDialog: DialogRenderer<'formPreview'> = ({ dialog: _dialog }) => ({
  body: <FormPreviewBody />,
  footer: <BackToPublish />,
});

function BackToPublish() {
  const act = usePlannerActions();
  return <button type="button" className="app-button" id="return-to-publish" onClick={() => act.openDialog({ kind: 'publish' })}>← Zpět k publikaci</button>;
}

/* ------------------------------ e-mail preview ------------------------------ */

function EmailPreviewBody() {
  const { base } = usePlanFigures();
  const profile = usePlannerProfile();
  const { catalogue } = usePlannerModelState();
  const link = useLink();
  const copy = useCopy();
  const mail = emailText(base, profile.clubName, catalogue?.clinicName ?? '', link);
  const { source } = usePlannerData();
  const hasLink = link !== null;
  /* Looking at the e-mail WITH its link is step 2 of the publication. */
  useEffect(() => { if (hasLink) published.set({ previewed: true, owner: source }); }, [hasLink, source]);
  return (
    <>
      <div className="pub-kicker">PŘED PŘÍPADNÝM ODESLÁNÍM</div>
      <div className="pub-side-heading">Náhled e-mailu klubu</div>
      <p className="pub-side-desc">Komu: {profile.contactEmail || 'kontaktní e-mail není vyplněn'}<br />Předmět: {mail.subject}</p>
      <div className="pub-link-row">
        <div className="pub-link" data-testid="email-link" data-url={link ?? ''}>{link ?? 'Odkaz zatím nebyl vygenerován - vygenerujte ho v „Připravit formulář“.'}</div>
        <CopyButton text={link ?? ''} ariaLabel="Zkopírovat odkaz pro klub" testId="email-link-copy" />
      </div>
      <div className="pub-email-body" data-testid="email-draft">{mail.body}</div>
      <div className="pub-actions">
        <button type="button" className="primary" id="pub-copy-email" onClick={() => void copy(mail.body, 'Text e-mailu zkopírován.', 'Nepodařilo se zkopírovat; označte text ručně.')}>Kopírovat text e-mailu</button>
      </div>
      <p className="pub-note">Plánovač neumí odeslat zprávu. Tlačítko pouze zkopíruje připravený text - e-mail pošlete sami.</p>
    </>
  );
}

export const emailPreviewDialog: DialogRenderer<'emailPreview'> = () => ({
  body: <EmailPreviewBody />,
  footer: <BackToPublish />,
});
