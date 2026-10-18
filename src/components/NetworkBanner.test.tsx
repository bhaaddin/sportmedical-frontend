import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import NetworkBanner, { OFFLINE_TEXT } from './NetworkBanner';

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
};

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});

describe('NetworkBanner', () => {
  it('draws nothing while the connection is fine (and so loads nothing)', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<NetworkBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the offline strip once the browser goes offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<NetworkBanner />);
    setOnline(false);
    expect(await screen.findByText(OFFLINE_TEXT, {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('says the connection is back, and the strip goes away', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<NetworkBanner />);
    setOnline(false);
    await screen.findByText(OFFLINE_TEXT, {}, { timeout: 15000 });
    setOnline(true);
    expect(await screen.findByText('Připojení obnoveno')).toBeInTheDocument();
  });
});
