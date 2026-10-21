/*
 * One state of the order, every place that shows a figure: they must all say the same (owner, 21. 10. 2026: "musí
 * fungovat kalkulačka" / "vše musí být propojené"). The table of places is in docs/club-planning-findings.md.
 * The state includes a term on a past day that was never saved: it counts for nothing in ANY of them.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { mountPlanner, ownerSource, term } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;

describe('every figure of the order agrees', () => {
  // TODAY of the harness is 2026-11-10. k: 6 + 2 slots of 60 min in the future, s: 4 slots; k also has 3 on a past day.
  const sessions = () => [
    term('k1', '2026-11-17', '08:00', '14:00', 'k', 6),
    term('k2', '2026-11-18', '08:00', '10:00', 'k', 2),
    term('s1', '2026-11-18', '10:30', '16:30', 's', 4),
    term('past', '2026-11-03', '08:00', '11:00', 'k', 3),
  ];

  it('card, summary, left panel and the order overview all read 8 / 20 for komplexní and 12 / 70 in total', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    await screen.findByTestId('planning-carousel');
    // 1. the činnost card
    expect(card('k').querySelector('.plan-num')).toHaveTextContent('8 / 20');
    expect(card('s').querySelector('.plan-num')).toHaveTextContent('4 / 50');
    // 2. the order's summary card
    const summary = screen.getByTestId('summary-card');
    expect(summary).toHaveTextContent('12');
    expect(summary).toHaveTextContent('/ 70');
    // 3. the left panel (the armed činnost's KPI)
    fireEvent.click(card('k'));
    await waitFor(() => expect(document.querySelector('#agenda-activity-kpi')).toHaveTextContent('8'));
    expect(document.querySelector('#agenda-activity-kpi')).toHaveTextContent('/ 20');
    expect(document.querySelector('#agenda-footer-status')).toHaveTextContent('Zbývá 12');
    // 4. the order overview
    fireEvent.click(document.querySelector('.oc-overview')!);
    const dialog = await screen.findByTestId('planner-dialog');
    expect(dialog).toHaveTextContent('12 / 70');
    const rows = dialog.querySelectorAll('.activity-detail-row');
    expect(within(rows[0] as HTMLElement).getByText(/8 \/ 20|8\/20/)).toBeInTheDocument();
  });
});

describe('a činnost with two lanes: 8 slots are 16 players everywhere', () => {
  it('card, summary and left panel agree (the left panel used to add up slots as players)', async () => {
    const source = ownerSource({
      categories: [{ id: 'k', name: 'Komplexní sportovní prohlídka', subtitle: 'Lékařské vyšetření', iconKey: 'heart', color: '#00f1dc', slotMinutes: 60, parallelCapacity: 2, priceCzk: 1600 }],
      demands: [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }],
      sessions: [term('k1', '2026-11-17', '08:00', '16:00', 'k', 8)],
    });
    mountPlanner(source);
    await screen.findByTestId('planning-carousel');
    expect(card('k').querySelector('.plan-num')).toHaveTextContent('16 / 20');
    expect(screen.getByTestId('summary-card')).toHaveTextContent('16');
    fireEvent.click(card('k'));
    await waitFor(() => expect(document.querySelector('#agenda-activity-kpi')).toHaveTextContent('16'));
    expect(document.querySelector('#agenda-footer-status')).toHaveTextContent('Zbývá 4');
  });
});
