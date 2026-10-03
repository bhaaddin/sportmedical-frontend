import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { DrawerFrame, DRAWER_WIDTH } from './DrawerFrame';

/*
 * Where the booking flow lives on each device (Etapa 2, decision 13):
 *   desktop            the 580 px side panel as drawn;
 *   tablet, upright    a bottom panel over half the height, expanding on a field;
 *   tablet, sideways   the side panel;
 *   phone              the whole screen, the primary action pinned at the bottom.
 */

function renderFrame(props: Partial<Parameters<typeof DrawerFrame>[0]> = {}) {
  const onClose = vi.fn();
  const onBack = vi.fn();
  render(
    <DrawerFrame
      open
      onClose={onClose}
      labelId="t"
      title="Objednat termín"
      subtitle="Krok 1 ze 2 — kdo přijde"
      footer={<button type="button">Pokračovat</button>}
      {...props}
    >
      <input aria-label="Jméno" />
      <textarea aria-label="Poznámka" />
    </DrawerFrame>,
  );
  return { onClose, onBack };
}

const panel = () => screen.getByRole('dialog', { name: 'Objednat termín' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
});

describe('desktop (1440)', () => {
  it('is the 580 px right-hand panel', () => {
    renderFrame();
    expect(panel()).toHaveAttribute('data-layout', 'side-panel');
    expect(panel()).toHaveStyle({ width: `${DRAWER_WIDTH}px` });
    expect(DRAWER_WIDTH).toBe(580);
    /* Title, the step under it, and a close button at the right. */
    expect(within(panel()).getByRole('heading', { name: 'Objednat termín' })).toBeInTheDocument();
    expect(within(panel()).getByText('Krok 1 ze 2 — kdo přijde')).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Zavřít' })).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: /panel/ })).not.toBeInTheDocument();
  });

  it('shows ‹ only when there is a step to go back to', async () => {
    const onBack = vi.fn();
    renderFrame({ onBack });
    await userEvent.click(within(panel()).getByRole('button', { name: 'Zpět' }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('tablet held upright (834 × 1112)', () => {
  beforeEach(() => setViewport(VIEWPORTS.tablet, 1112));

  it('is a bottom panel over half the height with a swipe handle', () => {
    renderFrame();
    expect(panel()).toHaveAttribute('data-layout', 'bottom-panel');
    expect(panel()).toHaveAttribute('data-expanded', 'false');
    /* Half of the viewport, not all of it - jsdom resolves vh to pixels. */
    expect(panel()).toHaveStyle({ width: '100%' });
    expect(getComputedStyle(panel()).height).not.toBe('100%');
    expect(getComputedStyle(panel()).height).toMatch(/^\d+px$/);
    expect(within(panel()).getByRole('button', { name: 'Rozbalit panel' })).toBeInTheDocument();
    /* The same header and footer, so nothing is lost by sitting at the bottom. */
    expect(within(panel()).getByRole('button', { name: 'Zavřít' })).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Pokračovat' })).toBeInTheDocument();
  });

  it('expands to the full height when a field takes the keyboard', async () => {
    renderFrame();
    expect(panel()).toHaveAttribute('data-expanded', 'false');
    await userEvent.click(within(panel()).getByLabelText('Jméno'));
    expect(panel()).toHaveAttribute('data-expanded', 'true');
    expect(panel()).toHaveStyle({ height: '100%' });
    expect(within(panel()).getByRole('button', { name: 'Sbalit panel' })).toBeInTheDocument();
  });

  it('also expands for a text area, but not for a plain button', async () => {
    renderFrame();
    await userEvent.click(within(panel()).getByRole('button', { name: 'Pokračovat' }));
    expect(panel()).toHaveAttribute('data-expanded', 'false');
    await userEvent.click(within(panel()).getByLabelText('Poznámka'));
    expect(panel()).toHaveAttribute('data-expanded', 'true');
  });

  it('opens and folds with the handle, by tap or by key', async () => {
    renderFrame();
    const handle = () => within(panel()).getByRole('button', { name: /(Rozbalit|Sbalit) panel/ });
    await userEvent.click(handle());
    expect(panel()).toHaveAttribute('data-expanded', 'true');
    await userEvent.click(handle());
    expect(panel()).toHaveAttribute('data-expanded', 'false');
    handle().focus();
    await userEvent.keyboard('{Enter}');
    expect(panel()).toHaveAttribute('data-expanded', 'true');
  });

  it('follows a swipe: up expands, down folds', () => {
    renderFrame();
    const handle = within(panel()).getByRole('button', { name: 'Rozbalit panel' });
    fireEvent.touchStart(handle, { touches: [{ clientY: 600 }] });
    fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 500 }] });
    expect(panel()).toHaveAttribute('data-expanded', 'true');

    const folded = within(panel()).getByRole('button', { name: 'Sbalit panel' });
    fireEvent.touchStart(folded, { touches: [{ clientY: 300 }] });
    fireEvent.touchEnd(folded, { changedTouches: [{ clientY: 420 }] });
    expect(panel()).toHaveAttribute('data-expanded', 'false');
  });

  it('ignores a twitch that is not a swipe', () => {
    renderFrame();
    const handle = within(panel()).getByRole('button', { name: 'Rozbalit panel' });
    fireEvent.touchStart(handle, { touches: [{ clientY: 600 }] });
    fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 590 }] });
    expect(panel()).toHaveAttribute('data-expanded', 'false');
  });

  it('keeps every small button inside it at 44 px or more', () => {
    render(
      <DrawerFrame open onClose={() => undefined} labelId="x" title="X">
        <button type="button" className="MuiButton-root MuiButton-sizeSmall" data-testid="small">
          Změnit
        </button>
      </DrawerFrame>,
    );
    /* The rule is on the body, applied by class to whichever component drew the button. */
    const body = screen.getByTestId('small').parentElement as HTMLElement;
    expect(getComputedStyle(screen.getByTestId('small')).minHeight).toBe('44px');
    expect(body).toBeInTheDocument();
  });
});

describe('tablet held sideways (1194 × 834)', () => {
  it('is the side panel again', () => {
    setViewport(1194, 834);
    renderFrame();
    expect(panel()).toHaveAttribute('data-layout', 'side-panel');
    expect(panel()).toHaveStyle({ width: `${DRAWER_WIDTH}px` });
    expect(panel()).not.toHaveAttribute('data-expanded');
  });
});

describe('phone (390)', () => {
  beforeEach(() => setViewport(VIEWPORTS.phone, 844));

  it('is the whole screen, with the primary action pinned in the footer', () => {
    renderFrame();
    expect(panel()).toHaveAttribute('data-layout', 'full-screen');
    expect(panel()).toHaveStyle({ width: '100%', height: '100%' });
    expect(within(panel()).getByTestId('panel-footer')).toContainElement(
      within(panel()).getByRole('button', { name: 'Pokračovat' }),
    );
  });

  it('puts the back arrow where the close button would be: "Zavřít" on the first step', async () => {
    const { onClose } = renderFrame();
    const arrow = within(panel()).getByRole('button', { name: 'Zavřít' });
    expect(arrow).toHaveStyle({ width: '44px', height: '44px' });
    /* One way out, not two. */
    expect(within(panel()).getAllByRole('button', { name: 'Zavřít' })).toHaveLength(1);
    await userEvent.click(arrow);
    expect(onClose).toHaveBeenCalled();
  });

  it('turns the arrow into "Zpět" on the second step', async () => {
    const onBack = vi.fn();
    const { onClose } = renderFrame({ onBack });
    await userEvent.click(within(panel()).getByRole('button', { name: 'Zpět' }));
    expect(onBack).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(within(panel()).queryByRole('button', { name: 'Zavřít' })).not.toBeInTheDocument();
  });

  it('has no swipe handle: it is not a sheet', () => {
    renderFrame();
    expect(within(panel()).queryByRole('button', { name: /panel/ })).not.toBeInTheDocument();
  });
});
