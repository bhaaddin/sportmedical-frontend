/*
 * Reviewer 2.6 - the per-činnost colour setting: palette, a typed colour, a LIVE preview with the text that reads on it, a reset to
 * the služba's shade, and the guard. The same editor serves Nastavení and the činnost dialog of Ceník.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityColorEditor, COLOR_EDITOR_TEXT } from './ActivityColorEditor';
import { GUARD_TEXT } from '../../../colors/activityColor';

afterEach(() => cleanup());

const PALETTE = ['#0D5C52', '#2563EB', '#E9C46A', '#001421'];

function mount(over: Partial<React.ComponentProps<typeof ActivityColorEditor>> = {}) {
  const onChange = vi.fn();
  render(<ActivityColorEditor activityName="Komplexní prohlídka" palette={PALETTE} value={null} fallback="#17A291" onChange={onChange} {...over} />);
  return { onChange };
}
const hexInput = () => screen.getByTestId('color-hex-input') as HTMLInputElement;
const pill = () => screen.getByTestId('color-preview-pill');
const type = (value: string) => fireEvent.change(hexInput(), { target: { value } });

describe('ActivityColorEditor', () => {
  it('shows the činnost\'s colour now - the default shade when it has none - in the preview and says which it is', () => {
    mount();
    expect(screen.getByTestId('color-state')).toHaveTextContent(COLOR_EDITOR_TEXT.inherited);
    expect(pill()).toHaveTextContent('Komplexní prohlídka');
    expect(getComputedStyle(pill()).backgroundColor).toBe('rgb(23, 162, 145)');
    cleanup();
    mount({ value: '#E9C46A' });
    expect(screen.getByTestId('color-state')).toHaveTextContent(COLOR_EDITOR_TEXT.own);
    expect(getComputedStyle(pill()).backgroundColor).toBe('rgb(233, 196, 106)');
  });

  it('a palette swatch applies at once and is marked on the colour that is in force', () => {
    const { onChange } = mount({ value: '#2563EB' });
    expect(screen.getByRole('button', { name: 'Barva #2563EB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Barva #0D5C52' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Barva #E9C46A' }));
    expect(onChange).toHaveBeenCalledWith('#E9C46A');
  });

  it('the palette is the clinic\'s own: a swatch nobody could see on the dark calendar is disabled with the reason', () => {
    const { onChange } = mount();
    const swatch = screen.getByRole('button', { name: 'Barva #001421' });
    expect(swatch).toBeDisabled();
    expect(swatch).toHaveAttribute('title', COLOR_EDITOR_TEXT.disabledSwatch);
    fireEvent.click(swatch);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('every swatch is a 44 px target', () => {
    mount();
    for (const swatch of within(screen.getByRole('group', { name: COLOR_EDITOR_TEXT.palette })).getAllByRole('button')) {
      /* MUI sx puts the size in a class; jsdom computes it */
      const style = getComputedStyle(swatch);
      expect(Number.parseFloat(style.width)).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(style.height)).toBeGreaterThanOrEqual(44);
    }
  });

  it('a typed colour shows in the preview AS IT IS TYPED, before anything is applied, with the text that reads on it', () => {
    const { onChange } = mount();
    type('#264653');
    expect(getComputedStyle(pill()).backgroundColor).toBe('rgb(38, 70, 83)');
    expect(getComputedStyle(pill()).color).toBe('rgb(255, 255, 255)');
    expect(screen.getByTestId('color-contrast')).toHaveTextContent(/Text na barvě: \d+,\d : 1 \(splňuje AA\)/);
    type('E9C46A');
    expect(getComputedStyle(pill()).backgroundColor).toBe('rgb(233, 196, 106)');
    expect(getComputedStyle(pill()).color).toBe('rgb(26, 29, 33)');
    expect(screen.getByTestId('color-visibility')).toHaveTextContent(/Na tmavém \d+,\d : 1 · na světlém \d+,\d : 1/);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('color-apply'));
    expect(onChange).toHaveBeenCalledWith('#E9C46A');
  });

  it('a text that is not a colour is refused with the sentence, and "Použít" waits', () => {
    mount();
    type('banana');
    expect(screen.getByText(GUARD_TEXT.notHex)).toBeInTheDocument();
    expect(screen.getByTestId('color-apply')).toBeDisabled();
  });

  it('a colour that vanishes on the dark calendar, or on the light page, cannot be applied and says why', () => {
    mount();
    type('#001421');
    expect(screen.getByText(GUARD_TEXT.tooDark)).toBeInTheDocument();
    expect(screen.getByTestId('color-apply')).toBeDisabled();
    type('#FEFEFE');
    expect(screen.getByText(GUARD_TEXT.tooLight)).toBeInTheDocument();
    expect(screen.getByTestId('color-apply')).toBeDisabled();
  });

  it('the colour already in force cannot be applied again; "Obnovit výchozí" gives the shade back (null) only when there is an own colour', () => {
    const { onChange } = mount({ value: '#E9C46A' });
    expect(screen.getByTestId('color-apply')).toBeDisabled();
    expect(screen.getByTestId('color-reset')).toBeEnabled();
    fireEvent.click(screen.getByTestId('color-reset'));
    expect(onChange).toHaveBeenCalledWith(null);
    cleanup();
    mount({ value: null });
    expect(screen.getByTestId('color-reset')).toBeDisabled();
  });

  it('shows the činnost in the three places the colour is drawn: a pill, a card on the dark calendar, a dot on the light page', () => {
    mount({ value: '#2563EB' });
    expect(screen.getByTestId('color-preview-pill')).toBeInTheDocument();
    expect(within(screen.getByTestId('color-preview-board')).getByText(/Komplexní prohlídka/)).toBeInTheDocument();
    expect(within(screen.getByTestId('color-preview-light')).getByText('Komplexní prohlídka')).toBeInTheDocument();
  });

  it('is disabled while a save is running', () => {
    mount({ busy: true });
    expect(hexInput()).toBeDisabled();
    expect(screen.getByTestId('color-apply')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Barva #2563EB' })).toBeDisabled();
  });
});
