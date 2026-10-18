import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MIN_NAME_SCALE, nameFit, useFitName } from './useFitName';

afterEach(() => cleanup());

describe('nameFit: the identity name shows in full (owner, 18. 10. 2026: "SportMedical Diagnostic|")', () => {
  it('leaves a name that fits at the file\'s size', () => {
    expect(nameFit(240, 266)).toEqual({ scale: 1, cut: false });
    expect(nameFit(266.4, 266)).toEqual({ scale: 1, cut: false });
    expect(nameFit(0, 266)).toEqual({ scale: 1, cut: false });
    expect(nameFit(300, 0)).toEqual({ scale: 1, cut: false });
  });

  it('shrinks a name that is too wide exactly to the room', () => {
    const fit = nameFit(300, 266);
    expect(fit.cut).toBe(false);
    expect(fit.scale).toBeLessThan(1);
    expect(300 * fit.scale).toBeLessThanOrEqual(266);
    expect(300 * fit.scale).toBeGreaterThan(265);
  });

  it('cuts with an ellipsis only when even the smallest size does not fit', () => {
    expect(nameFit(266 / MIN_NAME_SCALE, 266).cut).toBe(false);
    const fit = nameFit(900, 266);
    expect(fit).toEqual({ scale: MIN_NAME_SCALE, cut: true });
  });
});

function Name({ text }: { text: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const fit = useFitName(ref, text);
  return (
    <strong ref={ref} data-testid="name" title={fit.scale < 1 ? text : undefined} data-fit={fit.cut ? 'cut' : fit.scale < 1 ? 'shrunk' : undefined}>
      {text}
    </strong>
  );
}

/** jsdom has no layout: the text is `natural` wide, the block `available` wide (`--name-fit` is not applied to a fake box). */
function withWidths(natural: number, available: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => natural });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => available });
}

describe('useFitName in the header', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  });

  it('a name that fits has no tooltip and no fit marks', () => {
    withWidths(200, 266);
    const { getByTestId } = render(<Name text="FK Slaný" />);
    expect(getByTestId('name')).not.toHaveAttribute('title');
    expect(getByTestId('name')).not.toHaveAttribute('data-fit');
  });

  it('a too wide name is shrunk and carries its full text as the tooltip', () => {
    withWidths(300, 266);
    const { getByTestId } = render(<Name text="SportMedical Diagnostics s.r.o." />);
    expect(getByTestId('name')).toHaveAttribute('data-fit', 'shrunk');
    expect(getByTestId('name')).toHaveAttribute('title', 'SportMedical Diagnostics s.r.o.');
  });

  it('a name too long for the smallest size is cut', () => {
    withWidths(1200, 266);
    const { getByTestId } = render(<Name text={'Velmi dlouhý název sportovního klubu '.repeat(3)} />);
    expect(getByTestId('name')).toHaveAttribute('data-fit', 'cut');
  });
});
