import { describe, expect, it } from 'vitest';
import { BookingCard, LunchBandEl, SessionCard, WindowBlock } from './BoardCards';

/* speed-fe-3: the board's cards are React.memo components, so an untouched card is not drawn again while a neighbour is dragged. */
describe('board cards are memoised', () => {
  it.each([['SessionCard', SessionCard], ['BookingCard', BookingCard], ['WindowBlock', WindowBlock], ['LunchBandEl', LunchBandEl]])('%s', (_name, component) => {
    expect((component as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });
});
