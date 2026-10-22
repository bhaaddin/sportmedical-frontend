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

describe('BoardToolbar - no filter dropdown on the main calendar (R20), the club board keeps its činnost list', () => {
  const mount = (filter: string, serviceFilter?: boolean) =>
    render(
      <BoardToolbar head={weekHeadModel('2026-11-16')} view="week" filter={filter} categories={categories} today="2026-11-16" act={{} as BoundPlannerActions} entry={null} filterActive={false} {...(serviceFilter === undefined ? {} : { serviceFilter })} />,
    );
  const options = () => [...(document.getElementById('activity-filter') as HTMLSelectElement).options];

  it('the main calendar has no "Všechny služby" select at all - the Kalendáře chips are its selector', () => {
    mount('all');
    expect(document.getElementById('activity-filter')).toBeNull();
    expect(screen.queryByText('Všechny služby')).toBeNull();
    expect(screen.queryByText('Filtrovat podle služby')).toBeNull();
    /* the rest of the toolbar is still there */
    expect(screen.getByText('Týden')).toBeTruthy();
    expect(screen.getByLabelText('Nastavení')).toBeTruthy();
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
