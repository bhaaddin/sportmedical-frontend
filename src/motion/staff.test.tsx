/*
 * The staff app's motion: the setting in Nastavení, the number that counts once, the rows that arrive once, the dialog's
 * pop, the toast, the skeleton. Everything is observed through the real components; only the lazily loaded animation
 * library is a stand-in.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { MOTION_STORAGE_KEY, resetMotionStoreForTests } from './preference';
import type { MotionPreference } from './preference';

const fake = vi.hoisted(() => {
  const state = { loaded: true };
  const animate = vi.fn((target: unknown, _kf?: unknown, _options?: unknown) =>
    typeof target === 'number' ? ({ stop: vi.fn(), then: (fn: () => void) => Promise.resolve().then(fn) } as unknown as Promise<void>) : Promise.resolve(),
  );
  const api = {
    animate,
    inView: vi.fn((_el: unknown, cb: () => void) => {
      cb();
      return () => undefined;
    }),
    stagger: vi.fn((step: number) => ({ stagger: step })),
  };
  return { state, api };
});

vi.mock('./engine', () => ({
  loadMotion: vi.fn(() => Promise.resolve(fake.api)),
  motionIfLoaded: vi.fn(() => (fake.state.loaded ? fake.api : null)),
  warmMotion: vi.fn(),
  canObserve: () => true,
  resetEngineForTests: vi.fn(),
}));

import { ThemePrefsProvider } from '../ThemePrefsProvider';
import Settings from '../pages/Settings';
import { KpiCard } from '../components/ui/KpiCard';
import { CountUp } from './CountUp';
import { ResponsiveDataList } from '../components/ui/ResponsiveDataList';
import { setViewport, VIEWPORTS } from '../test/viewport';

function setMode(mode: MotionPreference | null) {
  window.localStorage.removeItem(MOTION_STORAGE_KEY);
  if (mode !== null) window.localStorage.setItem(MOTION_STORAGE_KEY, mode);
  resetMotionStoreForTests();
}
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }));
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
  fake.state.loaded = true;
  fake.api.animate.mockClear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  resetMotionStoreForTests();
  document.documentElement.removeAttribute('data-motion');
});

describe('Nastavení -> Osobní -> Vzhled -> Pohyb', () => {
  const renderSettings = () =>
    render(
      <ThemePrefsProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Settings />
        </MemoryRouter>
      </ThemePrefsProvider>,
    );

  it('offers the three states next to the colours, 44 px tall, with the current one pressed', () => {
    setMode(null);
    renderSettings();
    const group = screen.getByRole('group', { name: 'Pohyb v aplikaci' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Plné', 'Omezené', 'Vypnuto']);
    expect(within(group).getByRole('button', { name: 'Plné' }).getAttribute('aria-pressed')).toBe('true');
    for (const button of buttons) expect(getComputedStyle(button).minHeight).toBe('44px');
  });

  it('a click applies at once, is remembered under sm-motion, and is mirrored on <html>', () => {
    setMode(null);
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Vypnuto' }));
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('vypnuto');
    expect(document.documentElement.getAttribute('data-motion')).toBe('off');
    expect(screen.getByRole('button', { name: 'Vypnuto' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Plné' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Omezené' }));
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('omezené');
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduced');
  });

  it('can hand the decision back to the device', () => {
    setMode('omezené');
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Řídit se nastavením zařízení' }));
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Řídit se nastavením zařízení' })).toBeNull();
  });

  it('shows what the stored junk means: the device decides', () => {
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'bleskově');
    resetMotionStoreForTests();
    renderSettings();
    expect(screen.getByText(/podle nastavení vašeho zařízení/)).toBeTruthy();
  });
});

describe('the dashboard figures (a KpiCard whose value is a CountUp)', () => {
  it("show the plain number except under 'plné', where they count once", async () => {
    setMode('vypnuto');
    const { container, unmount } = render(<KpiCard label="Dnes objednáno" value={<CountUp value={12} />} />);
    await flush();
    expect(container.textContent).toContain('12');
    expect(fake.api.animate).not.toHaveBeenCalled();
    unmount();
    setMode('plné');
    render(<KpiCard label="Dnes objednáno" value={<CountUp value={12} />} />);
    await flush();
    expect(fake.api.animate).toHaveBeenCalled();
  });
});

describe('ResponsiveDataList rows', () => {
  type Row = { id: string; name: string };
  const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `Pacient ${i}` }));
  const list = (data: Row[]) => (
    <ResponsiveDataList
      rows={data}
      rowKey={(r) => r.id}
      columns={[{ key: 'name', header: 'Jméno', cell: (r) => r.name }]}
      renderCard={(r) => r.name}
    />
  );

  it('arrive one after another the first time the list has rows - and never again on a refetch', async () => {
    setMode('plné');
    const { rerender } = render(list([]));
    expect(fake.api.animate).not.toHaveBeenCalled();
    rerender(list(rows(5)));
    await flush();
    expect(fake.api.animate).toHaveBeenCalledTimes(1);
    expect((fake.api.animate.mock.calls[0][0] as HTMLElement[]).length).toBe(5);
    expect(fake.api.stagger).toHaveBeenCalledWith(0.022);
    rerender(list(rows(7)));
    rerender(list(rows(3)));
    await flush();
    expect(fake.api.animate).toHaveBeenCalledTimes(1);
  });

  it('are capped at 14 rows, and the rows are clickable DOM from the first frame', async () => {
    setMode('plné');
    render(list(rows(40)));
    await flush();
    expect((fake.api.animate.mock.calls[0][0] as HTMLElement[]).length).toBe(14);
    expect(screen.getAllByRole('row').length).toBe(41);
  });

  it("do not animate under 'omezené' or 'vypnuto', and leave no inline style behind", async () => {
    for (const mode of ['omezené', 'vypnuto'] as const) {
      setMode(mode);
      const { container, unmount } = render(list(rows(4)));
      await flush();
      expect(fake.api.animate).not.toHaveBeenCalled();
      container.querySelectorAll('tbody tr').forEach((tr) => expect(tr.getAttribute('style')).toBeNull());
      unmount();
    }
  });

  it('simply appear when the animation library has not arrived yet', async () => {
    setMode('plné');
    fake.state.loaded = false;
    const { container } = render(list(rows(4)));
    await flush();
    expect(fake.api.animate).not.toHaveBeenCalled();
    container.querySelectorAll('tbody tr').forEach((tr) => expect(tr.getAttribute('style')).toBeNull());
  });
});

describe('the stylesheet half (src/motion/motion.css)', () => {
  const css = readFileSync(resolve(__dirname, 'motion.css'), 'utf8');

  it("switches every transition and entrance animation off under data-motion='off', keeping progress indicators turning", () => {
    expect(css).toMatch(/html\[data-motion='off'\] \*,[\s\S]*transition-duration: 1ms !important/);
    expect(css).toMatch(/animation: none !important/);
    expect(css).toContain('.MuiCircularProgress-root');
  });

  it('pops a dialog about the pressed point, with full motion only', () => {
    expect(css).toMatch(/html\[data-motion='full'\] \.MuiDialog-container \{[^}]*transform-origin: var\(--sm-pop-x, 50%\) var\(--sm-pop-y, 50%\)/);
    expect(css).toContain('@keyframes sm-pop-in');
  });

  it('presses buttons to --sm-press, which is 1 (no transform) when motion is off', () => {
    expect(css).toMatch(/--sm-press: 1;/);
    expect(css).toMatch(/html\[data-motion='full'\],\s*html\[data-motion='reduced'\] \{\s*--sm-press: 0\.97;/);
    expect(css).toMatch(/:active:not\(\.Mui-disabled\) \{\s*scale: var\(--sm-press\);/);
  });

  it('every entrance animation needs html[data-motion=full]: without the attribute (script blocked) the page is static', () => {
    const blocks = css.split('}').filter((block) => /animation:/.test(block) && !/@keyframes|from|to \{/.test(block));
    for (const block of blocks) {
      const selector = block.split('{')[0];
      if (/MuiSkeleton|off'\]|toast|lenis|sm-press|MuiButton|MuiIconButton/.test(selector)) continue;
      expect(selector, block).toMatch(/data-motion='full'/);
    }
  });
});
