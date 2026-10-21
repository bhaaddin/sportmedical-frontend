import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { weekHeadModel, type PlannerCategory } from '../../model';
import type { BoundPlannerActions } from '../../state/PlannerStoreProvider';
import { BoardToolbar } from './BoardToolbar';

afterEach(() => cleanup());

const categories: PlannerCategory[] = [
  { id: 'a1', name: 'Základní prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, priceCzk: 1600, serviceId: 's1', serviceName: 'Sportovní lékařské prohlídky' },
  { id: 'a2', name: 'Komplexní prohlídka', iconKey: 'heart', color: '#00aadc', slotMinutes: 45, priceCzk: 2200, serviceId: 's1', serviceName: 'Sportovní lékařské prohlídky' },
  { id: 'a3', name: 'Fyzioterapie', iconKey: 'physio', color: '#ffb124', slotMinutes: 30, priceCzk: null, serviceId: 's2', serviceName: 'Fyzioterapie a regenerace' },
  /* an unaccented, differently cased twin of the first služba (the data once held both) */
  { id: 'a4', name: 'Další prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, priceCzk: 1600, serviceId: 's1b', serviceName: 'sportovni lekarske prohlidky' },
];

describe('BoardToolbar R1 - the filter lists služby, one entry each, with the price', () => {
  const mount = (filter: string, serviceFilter?: boolean) =>
    render(
      <BoardToolbar head={weekHeadModel('2026-11-16')} view="week" filter={filter} categories={categories} today="2026-11-16" act={{} as BoundPlannerActions} entry={null} filterActive={false} {...(serviceFilter === undefined ? {} : { serviceFilter })} />,
    );
  const options = () => [...(document.getElementById('activity-filter') as HTMLSelectElement).options];

  it('says "Všechny služby", lists only služby once (deduplicated by name without accents/case), "od" when činnosti differ', () => {
    mount('all');
    const text = options().map((o) => o.textContent);
    expect(text).toHaveLength(3);
    expect(text[0]).toBe('Všechny služby');
    expect(text[1]).toMatch(/^Sportovní lékařské prohlídky · od 1\s600\sKč$/);
    expect(text[2]).toBe('Fyzioterapie a regenerace · bez ceny');
    expect(text.join('|')).not.toContain('Základní prohlídka');
    expect(options()[1]!.title).toBe(text[1]);
    expect(options()[1]!.value).toBe('s1');
  });

  it('names the chosen služba with its price as the tooltip of the closed select, and labels it for a screen reader', () => {
    mount('s1');
    expect(document.getElementById('activity-filter')!.getAttribute('title')).toMatch(/^Sportovní lékařské prohlídky · od 1\s600\sKč$/);
    expect(screen.getByText('Filtrovat podle služby')).toBeTruthy();
  });

  it('a stale value (an old činnost id, a služba that is gone) reads as "Všechny služby"', () => {
    mount('a1');
    expect((document.getElementById('activity-filter') as HTMLSelectElement).value).toBe('all');
    cleanup();
    mount('s-gone');
    expect((document.getElementById('activity-filter') as HTMLSelectElement).value).toBe('all');
  });

  it("a club's own board keeps the činnosti of its order, with their prices", () => {
    mount('a1', false);
    const text = options().map((o) => o.textContent);
    expect(text[0]).toBe('Všechny činnosti');
    expect(text[1]).toMatch(/^Základní prohlídka · 1\s600\sKč$/);
    expect(text[3]).toBe('Fyzioterapie · bez ceny');
    expect(screen.getByText('Filtrovat podle činnosti')).toBeTruthy();
  });
});
