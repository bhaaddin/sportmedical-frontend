import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { deviceForWidth, useDevice } from './useDevice';
import { setViewport, VIEWPORTS } from '../test/viewport';

function Probe() {
  return <span data-testid="device">{useDevice()}</span>;
}

describe('the three interfaces', () => {
  it('names a width', () => {
    expect(deviceForWidth(390)).toBe('phone');
    expect(deviceForWidth(767)).toBe('phone');
    expect(deviceForWidth(768)).toBe('tablet');
    expect(deviceForWidth(1279)).toBe('tablet');
    expect(deviceForWidth(1280)).toBe('desktop');
  });

  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('answers %s at its test width', (name, width) => {
    setViewport(width);
    render(<Probe />);
    expect(screen.getByTestId('device').textContent).toBe(name);
  });
});
