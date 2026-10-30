/* Package discounts: služba first, then only its činnosti. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackageEditor } from './DiscountEditors';

const activities = [
  { id: 'a1', name: 'Základní', isActive: true, clinicServiceId: 's1' },
  { id: 'a2', name: 'Spiroergo', isActive: true, clinicServiceId: 's2' },
];
const services = [{ id: 's1', name: 'Prohlídky' }, { id: 's2', name: 'Diagnostika' }];
const row = { key: 'k1', activityId: '', percent: '' };

describe('PackageEditor', () => {
  it('lists činnosti of the chosen služba only', async () => {
    render(<PackageEditor rows={[row]} errors={{}} activities={activities} services={services} onChange={vi.fn()} />);
    expect(screen.getAllByLabelText('Činnost balíčku 1')[0]).toBeDisabled();
    await userEvent.selectOptions(screen.getAllByLabelText('Služba balíčku 1')[0], 's2');
    const names = Array.from((screen.getAllByLabelText('Činnost balíčku 1')[0] as HTMLSelectElement).options).map((o) => o.textContent);
    expect(names).toEqual(['Vyberte činnost', 'Spiroergo']);
  });

  it('draws one list when only one služba has činnosti', () => {
    render(<PackageEditor rows={[row]} errors={{}} activities={[activities[0]]} services={services} onChange={vi.fn()} />);
    expect(screen.queryAllByLabelText('Služba balíčku 1')).toHaveLength(0);
    expect(screen.getAllByLabelText('Činnost balíčku 1')[0]).toBeEnabled();
  });
});
