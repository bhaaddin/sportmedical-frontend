import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SiteLink, WebRouterContext } from './SiteLink';

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function mount(motion: string | null) {
  if (motion === null) document.documentElement.removeAttribute('data-motion');
  else document.documentElement.setAttribute('data-motion', motion);
  return render(
    <WebRouterContext.Provider value>
      <MemoryRouter initialEntries={['/']}>
        <SiteLink to="/cenik">Ceník</SiteLink>
        <SiteLink to="/#sluzby">Služby na této stránce</SiteLink>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </WebRouterContext.Provider>,
  );
}

const start = vi.fn((update: () => void) => {
  update();
  return {};
});

afterEach(() => {
  cleanup();
  start.mockClear();
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  document.documentElement.removeAttribute('data-motion');
});

describe('a link between two public pages', () => {
  it("runs the navigation inside a view transition under full motion, and lands on the page", () => {
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    mount('full');
    fireEvent.click(screen.getByRole('link', { name: 'Ceník' }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where').textContent).toBe('/cenik');
  });

  it.each(['reduced', 'off', null])("is an ordinary navigation when data-motion is %s", (motion) => {
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    mount(motion);
    fireEvent.click(screen.getByRole('link', { name: 'Ceník' }));
    expect(start).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/cenik');
  });

  it('is an ordinary navigation in a browser without View Transitions', () => {
    mount('full');
    fireEvent.click(screen.getByRole('link', { name: 'Ceník' }));
    expect(screen.getByTestId('where').textContent).toBe('/cenik');
  });

  it('leaves a modified click (a new tab) and a link to the same page alone', () => {
    (document as unknown as { startViewTransition: typeof start }).startViewTransition = start;
    mount('full');
    const swallow = (event: Event) => event.preventDefault(); // jsdom cannot open a new tab
    document.addEventListener('click', swallow);
    fireEvent.click(screen.getByRole('link', { name: 'Ceník' }), { ctrlKey: true });
    document.removeEventListener('click', swallow);
    expect(start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: 'Služby na této stránce' }));
    expect(start).not.toHaveBeenCalled();
  });
});
