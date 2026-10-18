import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { weekHeadModel, type PlannerCategory } from '../../model';
import type { BoundPlannerActions } from '../../state/PlannerStoreProvider';
import { BoardToolbar } from './BoardToolbar';

afterEach(() => cleanup());

const categories: PlannerCategory[] = [
  { id: 'a1', name: 'Základní prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, priceCzk: 1600 },
  { id: 'a2', name: 'Fyzioterapie', iconKey: 'physio', color: '#ffb124', slotMinutes: 30, priceCzk: null },
];

describe('BoardToolbar činnost filter lists the price next to every činnost', () => {
  const mount = (filter: string) =>
    render(
      <BoardToolbar head={weekHeadModel('2026-11-16')} view="week" filter={filter} categories={categories} today="2026-11-16" act={{} as BoundPlannerActions} entry={null} filterActive={false} />,
    );

  it('names the price in each option and in its tooltip; "bez ceny" without one', () => {
    mount('all');
    const select = document.getElementById('activity-filter') as HTMLSelectElement;
    const text = [...select.options].map((o) => o.textContent);
    expect(text[0]).toBe('Všechny činnosti');
    expect(text[1]).toMatch(/^Základní prohlídka · 1\s600\sKč$/);
    expect(text[2]).toBe('Fyzioterapie · bez ceny');
    expect(select.options[1]!.title).toBe(text[1]);
    expect(select).not.toHaveAttribute('title');
  });

  it('gives the closed select the chosen činnost with its price as tooltip', () => {
    mount('a1');
    expect(document.getElementById('activity-filter')!.getAttribute('title')).toMatch(/^Základní prohlídka · 1\s600\sKč$/);
    expect(screen.getByText('Filtrovat podle činnosti')).toBeTruthy();
  });
});
