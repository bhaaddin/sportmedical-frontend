import { describe, expect, it } from 'vitest';
import { nextStepOf } from './orderLogic';

const o = (over: Partial<Parameters<typeof nextStepOf>[0]> = {}): Parameters<typeof nextStepOf>[0] => ({
  status: 'Confirmed', registered: 0, totalSeats: 10, paymentMethod: 'ClubInvoice', invoiceId: null, ...over,
});

describe('nextStepOf (R10: what the desk does next with an order)', () => {
  it('Invited waits for the club and points at its link', () => expect(nextStepOf(o({ status: 'Invited' }))).toMatch(/odkaz na formulář/));
  it('Requested asks to process the inquiry', () => expect(nextStepOf(o({ status: 'Requested' }))).toMatch(/^Klub poslal poptávku/));
  it('Confirmed with seats left counts the missing players, in the right plural', () => {
    expect(nextStepOf(o({ registered: 9 }))).toBe('Chybí 1 hráč. Pošlete klubu odkaz pro hráče.');
    expect(nextStepOf(o({ registered: 7 }))).toMatch(/^Chybí 3 hráči\./);
    expect(nextStepOf(o({ registered: 0 }))).toMatch(/^Chybí 10 hráčů\./);
  });
  it('Confirmed and full: invoice the club, unless it is billed or paid per person', () => {
    expect(nextStepOf(o({ registered: 10 }))).toMatch(/Vystavte fakturu klubu/);
    expect(nextStepOf(o({ registered: 10, invoiceId: 'i1' }))).toBeNull();
    expect(nextStepOf(o({ registered: 10, paymentMethod: 'PerPerson' }))).toBeNull();
  });
  it('Completed: only an unbilled club invoice is left to do', () => {
    expect(nextStepOf(o({ status: 'Completed' }))).toMatch(/Zbývá vystavit fakturu/);
    expect(nextStepOf(o({ status: 'Completed', invoiceId: 'i1' }))).toBeNull();
  });
  it('a cancelled order asks nothing', () => expect(nextStepOf(o({ status: 'Cancelled' }))).toBeNull());
});
