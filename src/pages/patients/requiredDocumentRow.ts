/*
 * What one required document says about itself on the patient card.
 *
 * Two rules, agreed with the owner, and both are about what a person actually
 * reads on a screen they open twenty times a day.
 *
 * SHOW THE DATE, NOT A VERDICT
 *
 * "Hotovo" answers a question nobody has. "Výpis z 3. 5. 2026" answers the one
 * they do have - is it recent enough - and it answers it without anybody
 * having to click. A verdict is the screen having decided for the reader and
 * then not telling them what it decided from.
 *
 * KEEP THE ALARM FOR THE ALARM
 *
 *     chybí          red      something must be done
 *     při 1. návštěvě blue    worth knowing, nothing to do today
 *     on file        grey     a fact, not an achievement
 *
 * The green tick went for that reason. A card carrying twenty green ticks
 * teaches its reader to stop looking at that column, and the twenty-first time
 * it is red nobody sees it. Green is the most expensive colour on a screen
 * because it is spent on the case that needs nothing.
 *
 * NOT HERE YET
 *
 * The third state - "expires in three weeks", amber, the one window where the
 * fix is cheap - needs a validity date per patient and no endpoint carries
 * one. `expiringSoonCount` is a count, `hasVypis` is a boolean, `expiryAt` is
 * never computed. Asked for; not guessed at.
 */
import { formatDateOnly } from '../../utils/time';
import { remainingText, reportValidity, validUntilFromIssued } from '../../services/reportValidity';
import type { DocumentTemplate, PatientDocument } from '../../api/documents';

/*
 * `first-visit` is gone. It was drawn off `template.firstVisitOnly`, which the
 * server stopped sending on 14. 9. 2026 - "only the first time" moved onto the
 * rule, where it is one service's decision rather than a property of the
 * document kind. The read returned `undefined`, so the tone was unreachable
 * before it was removed.
 */
export type RequiredRowTone =
  | 'missing'      // red: nothing on file, or what is on file has run out
  | 'expiring'     // amber: still good, and the cheap moment to fix it is now
  | 'on-file';     // grey: a fact, not an achievement

export interface RequiredRowState {
  tone: RequiredRowTone;
  /** What the row says where a verdict used to be. */
  text: string;
  /** The second line, when the first does not hold everything. */
  detail?: string;
}

/*
 * How close to the end counts as close.
 *
 * A month, because that is the window where the fix is still cheap: a výpis
 * running out in three weeks can be asked for at this visit, while the patient
 * is in the room. Without it the first anybody hears of it is the day somebody
 * has to be sent home.
 */
export const EXPIRING_SOON_DAYS = 30;

/**
 * The document's own date, which is the one worth reading.
 *
 * `reportDate` is when the výpis was issued by the other doctor - the fact
 * that decides whether it is still any use. It is optional today, so the
 * upload date stands in: less useful, still a date, and still better than
 * "Hotovo", which is not information at all.
 */
function dateOf(document: PatientDocument): string {
  if (document.reportDate !== null && document.reportDate !== undefined) {
    return `z ${formatDateOnly(document.reportDate.slice(0, 10))}`;
  }
  const uploaded = document.uploadedAt?.slice(0, 10);
  return uploaded ? `nahráno ${formatDateOnly(uploaded)}` : 'nahráno';
}

export function requiredRowState(
  template: DocumentTemplate,
  filed: PatientDocument | undefined,
  today: Date = new Date(),
): RequiredRowState {
  if (filed !== undefined) {
    /*
     * Only the výpis runs out. Other required documents have no validity of
     * their own, so asking after one would invent a deadline nobody set.
     */
    const until =
      template.type === 'Vypis' ? validUntilFromIssued(filed.reportDate) : null;

    if (until !== null) {
      const validity = reportValidity(until, today);

      /*
       * An expired výpis is a missing výpis, and says the same sentence. The
       * owner asked for exactly that: "keď platnosť uplynie, hláška je jedna a
       * jednoduchá - treba doplniť výpis, rovnaká ako keď výpis nikdy nebol,
       * bez strašenia".
       */
      if (validity.kind !== 'valid') {
        /* The same word as never-filed, as the owner asked: "keď platnosť
           uplynie, hláška je jedna a jednoduchá, rovnaká ako keď výpis nikdy
           nebol". The date goes on the second line, where it explains rather
           than competes. */
        return {
          tone: 'missing',
          text: 'Není doloženo',
          detail: `platnost skončila ${formatDateOnly(until)}`,
        };
      }

      const text = `${dateOf(filed)} · platí do ${formatDateOnly(until)}`;
      return validity.daysLeft <= EXPIRING_SOON_DAYS
        ? { tone: 'expiring', text, detail: remainingText(validity.daysLeft) }
        : { tone: 'on-file', text, detail: remainingText(validity.daysLeft) };
    }

    return { tone: 'on-file', text: dateOf(filed) };
  }

  /*
   * "Není doloženo", not "Chybí".
   *
   * This row is on the documents screen, which lists every kind of document
   * the clinic keeps - it is not a list of what this patient owes. Whether
   * they owe it depends on what they are booked for, and that question is
   * answered on the card above, off the server, per appointment.
   *
   * There used to be a `first-visit` tone here, off `template.firstVisitOnly`.
   * The server stopped sending that on 14. 9. 2026 - it moved onto the rule,
   * where "only the first time" is one service's decision rather than a fact
   * about the document kind. Reading it here returned `undefined`, so the tone
   * was already dead before it was deleted.
   */
  return { tone: 'missing', text: 'Není doloženo' };
}
