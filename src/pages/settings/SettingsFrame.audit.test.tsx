/*
 * "Poslední změny" under each screen of the second half: asked for under the key the history really files the
 * setting under, and left off for the screens whose saves it never records (a panel saying "nobody changed
 * anything" under a screen somebody just changed is a lie).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsScreen } from './SettingsFrame';
import { SETTINGS_SECTIONS, scopeOf } from './catalogue';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

const MINE = ['komunikace-a-dokumenty', 'ucet', 'administrace'];
const items = SETTINGS_SECTIONS.filter((s) => MINE.includes(s.id)).flatMap((s) => s.items);

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: { items: [], total: 0 } });
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'users.manage', 'communication.manage', 'questionnaires.manage']));
  setViewport(VIEWPORTS.desktop);
});

const frame = (to: string) =>
  render(
    <MemoryRouter initialEntries={[to]}>
      <SettingsScreen title="X" subtitle="Y"><div>obsah</div></SettingsScreen>
    </MemoryRouter>,
  );

describe('Poslední změny under the screens that record their saves', () => {
  it.each(items.filter((i) => scopeOf(i) !== null).map((i) => [i.id, i.to, scopeOf(i)] as const))(
    '%s (%s) asks for the changes of %s',
    async (_id, to, scope) => {
      frame(to);
      await waitFor(() => expect(get).toHaveBeenCalledWith('/api/v1/settings/changes', { params: { scope, take: 5 } }));
      expect(await screen.findByRole('region', { name: 'Poslední změny' })).toBeInTheDocument();
    },
  );
});

describe('Poslední změny under the screens that do not', () => {
  it.each(items.filter((i) => scopeOf(i) === null).map((i) => [i.id, i.to] as const))(
    '%s (%s) draws no such panel and asks for nothing',
    async (_id, to) => {
      frame(to);
      await screen.findByText('obsah');
      expect(screen.queryByRole('region', { name: 'Poslední změny' })).toBeNull();
      expect(get).not.toHaveBeenCalled();
    },
  );
});
