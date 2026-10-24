import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AccentRootVars, applyVariables } from './AccentRootVars';
import { ThemePrefsContext } from './themePrefs';
import { accentVariables, DEFAULT_ACCENT_HEX } from './accent';
import { THEME_ACCENTS } from './theme';

const root = document.documentElement;
afterEach(() => {
  cleanup();
  root.removeAttribute('style');
  root.removeAttribute('data-sm-mode');
});

const prefs = (accent: string, mode: 'light' | 'dark') => ({ accent, mode, setAccent: () => undefined, setMode: () => undefined });
const mount = (accent: string, mode: 'light' | 'dark') =>
  render(
    <ThemePrefsContext.Provider value={prefs(accent, mode)}>
      <AccentRootVars />
    </ThemePrefsContext.Provider>,
  );

describe('applyVariables', () => {
  it('sets a value and removes a null', () => {
    const el = document.createElement('div');
    applyVariables(el, { '--a': '1', '--b': '2' });
    expect(el.style.getPropertyValue('--a')).toBe('1');
    applyVariables(el, { '--a': null, '--b': '3' });
    expect(el.style.getPropertyValue('--a')).toBe('');
    expect(el.style.getPropertyValue('--b')).toBe('3');
  });
  it('removing a property that was never set is harmless', () => {
    const el = document.createElement('div');
    expect(() => applyVariables(el, { '--zzz': null })).not.toThrow();
  });
});

describe('AccentRootVars', () => {
  it('draws nothing', () => {
    const { container } = mount('#EA580C', 'dark');
    expect(container).toBeEmptyDOMElement();
  });

  it.each(THEME_ACCENTS.flatMap((a) => (['light', 'dark'] as const).map((m) => [a.label, a.color, m] as const)))(
    '%s (%s) %s: every variable equals accentVariables',
    (_label, color, mode) => {
      mount(color, mode);
      for (const [name, value] of Object.entries(accentVariables(color, mode))) {
        expect(root.style.getPropertyValue(name)).toBe(value ?? '');
      }
    },
  );

  it('re-applies when the accent or the mode changes, without remounting', () => {
    const { rerender } = mount('#EA580C', 'dark');
    const dark = root.style.getPropertyValue('--sm-accent');
    rerender(
      <ThemePrefsContext.Provider value={prefs('#EA580C', 'light')}>
        <AccentRootVars />
      </ThemePrefsContext.Provider>,
    );
    expect(root.style.getPropertyValue('--sm-accent')).toBe('#EA580C');
    expect(root.style.getPropertyValue('--sm-accent')).not.toBe(dark);
    rerender(
      <ThemePrefsContext.Provider value={prefs(DEFAULT_ACCENT_HEX, 'light')}>
        <AccentRootVars />
      </ThemePrefsContext.Provider>,
    );
    expect(root.style.getPropertyValue('--sm-accent')).toBe('');
    expect(root.style.getPropertyValue('--sm-hsl')).toBe('');
  });

  it('leaves unrelated inline styles of the root alone, on set and on cleanup', () => {
    root.style.setProperty('--other', 'keep');
    const { unmount } = mount('#2563EB', 'dark');
    expect(root.style.getPropertyValue('--other')).toBe('keep');
    unmount();
    expect(root.style.getPropertyValue('--other')).toBe('keep');
    expect(root.style.getPropertyValue('--sm-hsl')).toBe('');
  });

  it('throws without a provider, like every consumer of the preferences', () => {
    const spy = console.error;
    console.error = () => undefined;
    expect(() => render(<AccentRootVars />)).toThrow(/ThemePrefsContext/);
    console.error = spy;
  });
});

describe('AccentRootVars - the mode attribute the light stylesheet of the planner hangs on (R15e)', () => {
  it.each(['light', 'dark'] as const)('puts data-sm-mode="%s" on the document root and removes it on unmount', (mode) => {
    const { unmount } = mount(DEFAULT_ACCENT_HEX, mode);
    expect(root.getAttribute('data-sm-mode')).toBe(mode);
    unmount();
    expect(root.hasAttribute('data-sm-mode')).toBe(false);
  });

  it('follows the Světlý/Tmavý switch without remounting', () => {
    const { rerender } = mount('#EA580C', 'dark');
    expect(root.getAttribute('data-sm-mode')).toBe('dark');
    rerender(
      <ThemePrefsContext.Provider value={prefs('#EA580C', 'light')}>
        <AccentRootVars />
      </ThemePrefsContext.Provider>,
    );
    expect(root.getAttribute('data-sm-mode')).toBe('light');
  });

  it('reads the planner tint from the preferences: the planner variables follow it, the accent stays', () => {
    render(
      <ThemePrefsContext.Provider value={{ ...prefs('#2563EB', 'light'), plannerTint: '#EA580C' }}>
        <AccentRootVars />
      </ThemePrefsContext.Provider>,
    );
    expect(root.style.getPropertyValue('--sm-planner-accent')).toBe('#EA580C');
    expect(root.style.getPropertyValue('--sm-accent')).toBe('#2563EB');
  });
  it('the clinic tint applies when this browser has none of its own; a browser tint wins over it', () => {
    const { rerender } = render(
      <ThemePrefsContext.Provider value={{ ...prefs('#2563EB', 'light'), plannerTint: null, clinicPlannerTint: '#7C3AED' }}>
        <AccentRootVars />
      </ThemePrefsContext.Provider>,
    );
    expect(root.style.getPropertyValue('--sm-planner-accent')).toBe('#7C3AED');
    rerender(
      <ThemePrefsContext.Provider value={{ ...prefs('#2563EB', 'light'), plannerTint: '#EA580C', clinicPlannerTint: '#7C3AED' }}>
        <AccentRootVars />
      </ThemePrefsContext.Provider>,
    );
    expect(root.style.getPropertyValue('--sm-planner-accent')).toBe('#EA580C');
  });
});
