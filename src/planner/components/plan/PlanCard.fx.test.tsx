/*
 * "Splněno": the card of a činnost that has just been fulfilled gets `just-done` for a moment (the glow, the tick pop in
 * planner.fx.css), then is calm again; a card that was complete from the start never does it.
 */
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { mountPlanner, ownerSource, term } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;

describe('the "splněno" moment', () => {
  it('fulfilling a činnost marks its card for a moment; a card that starts complete does not', async () => {
    const source = ownerSource({
      demands: [{ categoryId: 'k', requested: 4, baselinePlanned: 0 }, { categoryId: 's', requested: 2, baselinePlanned: 0 }],
      sessions: [term('s1', '2026-11-17', '08:00', '11:00', 's', 2), term('k1', '2026-11-18', '08:00', '10:00', 'k', 2)],
    });
    mountPlanner(source);
    await screen.findByTestId('planning-carousel');
    expect(card('s')).toHaveClass('is-complete');
    expect(card('s')).not.toHaveClass('just-done');
    expect(card('k')).not.toHaveClass('is-complete');
    await act(async () => {
      await source.createInterval({ date: '2026-11-19', categoryId: 'k', start: '08:00', quantity: 2 });
    });
    await waitFor(() => expect(card('k')).toHaveClass('is-complete'));
    expect(card('k')).toHaveClass('just-done');
    await waitFor(() => expect(card('k')).not.toHaveClass('just-done'), { timeout: 3000 });
    expect(card('k')).toHaveClass('is-complete');
  });
});
