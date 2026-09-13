/*
 * A screen that contradicted itself on one row.
 *
 * `DELETE /api/activities/{id}` retires: the row stays, keeps its slug, is
 * marked "vyřazeno", and `POST …/restore` brings it back. The screen said
 * "Smazat", and its confirmation said "Tuto akci nelze vrátit zpět" - while
 * the button that undoes it, "Vrátit do nabídky", sat two columns along the
 * same row.
 *
 * This is the fault the owner named at the calendars in his own words:
 * "neaktívny je keď ho zneaktívnim, a nie keď ho odstránim". Wording only here
 * - činnosti may yet get the split the calendars got, and building that now
 * would be thrown away. A sentence that is false today is false whatever the
 * contract becomes.
 */
import { describe, it, expect } from 'vitest';
import cs from '../../i18n/locales/cs.json';
import pageSource from './ActivitiesPage.tsx?raw';

const wording = (cs as { booking: { activities: Record<string, string> } })
  .booking.activities;

describe('what the retire button says', () => {
  it('does not call it deleting', () => {
    for (const key of ['retireAction', 'deleteTitle', 'deleteBody'] as const) {
      expect(wording[key], key).toBeDefined();
      expect(wording[key].toLowerCase(), key).not.toMatch(/smazat|smazán/);
    }
  });

  /*
   * The contradiction itself. Claiming finality beside a working undo teaches
   * the reader that the warnings on this screen are not to be believed - which
   * is worse than this one sentence, because the next one may be true.
   */
  it('does not claim it cannot be undone', () => {
    expect(wording.deleteBody.toLowerCase()).not.toMatch(/nelze vrátit|nelze vzít zpět/);
  });

  it('says instead how to undo it, in the words of the button that does', () => {
    expect(wording.deleteBody).toContain(wording.restore);
  });

  it('says the row stays and is marked', () => {
    expect(wording.deleteBody).toMatch(/vyřazen/);
  });
});

describe('the screen uses its own wording, not the shared one', () => {
  /*
   * `booking.common.delete` is "Smazat" and stays that way - the calendars
   * really do delete now. This screen must not borrow it.
   */
  it('does not reach for the shared Smazat', () => {
    expect(pageSource as string).not.toContain('booking.common.delete');
  });

  it('uses the retire wording for the action and the confirmation', () => {
    expect(pageSource as string).toContain('booking.activities.retireAction');
  });
});
