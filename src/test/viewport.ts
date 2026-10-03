import { deviceForWidth } from '../layout/useDevice';

/*
 * Render a screen at one of the three widths.
 *
 *   setViewport(VIEWPORTS.phone);   // before render()
 *
 * Mocks window.matchMedia (min/max-width, and the MUI breakpoints that are
 * built from them) and window.innerWidth/innerHeight so both useDevice() and
 * MUI's useMediaQuery answer for that width. Call it again to switch.
 */
export const VIEWPORTS = { phone: 390, tablet: 834, desktop: 1440 } as const;
export type ViewportName = keyof typeof VIEWPORTS;

function matches(query: string, width: number): boolean {
  const normalized = query.replace(/\s+/g, ' ').toLowerCase();
  const parts = normalized.match(/\((min|max)-width:\s*([\d.]+)px\)/g);
  if (parts === null) return false;
  return parts.every((part) => {
    const m = /\((min|max)-width:\s*([\d.]+)px\)/.exec(part);
    if (m === null) return false;
    const limit = Number(m[2]);
    return m[1] === 'min' ? width >= limit : width <= limit;
  });
}

export function setViewport(width: number, height = 900): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height });
  window.matchMedia = ((query: string) => {
    const listeners = new Set<() => void>();
    return {
      matches: matches(query, width),
      media: query,
      onchange: null,
      addListener: (l: () => void) => listeners.add(l),
      removeListener: (l: () => void) => listeners.delete(l),
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

/** The device a name stands for, to assert against. */
export const deviceOf = (name: ViewportName) => deviceForWidth(VIEWPORTS[name]);
