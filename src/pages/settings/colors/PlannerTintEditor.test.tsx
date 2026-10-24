/*
 * The planner tint editor (R15d): palette, custom colour with a guard, a live preview in BOTH modes, a way back to "follow the accent".
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlannerTintEditor, TINT_TEXT, guardTint } from './PlannerTintEditor';
import { THEME_ACCENTS } from '../../../theme';

const mount = (props: Partial<React.ComponentProps<typeof PlannerTintEditor>> = {}) => {
  const onChange = vi.fn();
  render(<PlannerTintEditor value="#0D5C52" followed palette={[]} onChange={onChange} {...props} />);
  return onChange;
};

describe('guardTint', () => {
  it.each([['#2563EB', true], ['2563eb', true], ['#FFFFFF', false], ['#F5F5DC', false], ['red', false], ['', false], ['#12345', false]])('%j -> ok %s', (input, ok) => {
    expect(guardTint(input).ok).toBe(ok);
  });
  it('says why in Czech', () => {
    expect(guardTint('#FFFFFF').problem).toBe(TINT_TEXT.tooPale);
    expect(guardTint('nonsense').problem).toBe(TINT_TEXT.notHex);
  });
});

describe('PlannerTintEditor', () => {
  it('offers the six colours of the application and applies one at once', async () => {
    const onChange = mount();
    const group = screen.getByRole('group', { name: TINT_TEXT.palette });
    expect(within(group).getAllByRole('button')).toHaveLength(THEME_ACCENTS.length);
    await userEvent.setup().click(within(group).getByRole('button', { name: 'Barva plánovače #2563EB' }));
    expect(onChange).toHaveBeenCalledWith('#2563EB');
  });

  it('refuses a colour too pale to be a button, says why, and keeps Použít off', async () => {
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('tint-hex-input'), '#FFFFFF');
    expect(screen.getByText(TINT_TEXT.tooPale)).toBeInTheDocument();
    expect(screen.getByTestId('tint-apply')).toBeDisabled();
  });

  it('applies a typed colour and shows the live preview in dark and in light with the contrast', async () => {
    const onChange = mount();
    const user = userEvent.setup();
    await user.type(screen.getByTestId('tint-hex-input'), 'ea580c');
    expect(screen.getByTestId('tint-preview-dark')).toBeInTheDocument();
    expect(screen.getByTestId('tint-preview-light')).toBeInTheDocument();
    expect(screen.getByTestId('tint-contrast').textContent).toMatch(/: 1/);
    await user.click(screen.getByTestId('tint-apply'));
    expect(onChange).toHaveBeenCalledWith('#EA580C');
  });

  it('"Sledovat barvu aplikace" is off while following and gives null back once a tint is set', async () => {
    const onChange = mount({ followed: false, value: '#7C3AED' });
    expect(screen.getByTestId('tint-state')).toHaveTextContent(TINT_TEXT.ownNow);
    await userEvent.setup().click(screen.getByTestId('tint-follow'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('says it follows the application when no tint is set', () => {
    mount();
    expect(screen.getByTestId('tint-state')).toHaveTextContent(TINT_TEXT.followsNow);
    expect(screen.getByTestId('tint-follow')).toBeDisabled();
  });

  it('adds the clinic palette after the application colours, without duplicates or colours that cannot be a button', () => {
    mount({ palette: ['#2563EB', '#112233', '#FFFFFF'] });
    const group = screen.getByRole('group', { name: TINT_TEXT.palette });
    const names = within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toContain('Barva plánovače #112233');
    expect(names.filter((n) => n === 'Barva plánovače #2563EB')).toHaveLength(1);
    expect(names).not.toContain('Barva plánovače #FFFFFF');
  });
});
