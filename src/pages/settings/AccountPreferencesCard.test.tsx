/*
 * Choosing a theme saves it on the account and applies it here at once; the
 * catalogue - labels and help - is the server's, not a copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountPreferencesCard } from './AccountPreferencesCard';
import { readAccountPreferences, saveAccountPreferences } from '../../api/accountPreferences';
import { parsePreferences, preferencesSnapshot } from '../../auth/preferences';

vi.mock('../../api/accountPreferences', () => ({
  readAccountPreferences: vi.fn(),
  saveAccountPreferences: vi.fn(),
}));

const catalogue = {
  themes: [
    { key: 'clinic-light', label: 'Klinika – světlá', help: 'Světlé pozadí.' },
    { key: 'calm-warm', label: 'Klid – teplá', help: 'Tlumené teplé odstíny.' },
    { key: 'contrast-dark', label: 'Kontrast – tmavá', help: 'Tmavé pozadí.' },
    { key: 'print-mono', label: 'Tisk – černobílá', help: 'Bez barev.' },
  ],
  workspaces: [
    { key: 'full', label: 'Plné rozhraní', help: 'Všechno.' },
    { key: 'doctor', label: 'Lékařské rozhraní', help: 'Jen dnešní kalendář.' },
  ],
};

beforeEach(() => {
  vi.mocked(readAccountPreferences).mockResolvedValue({
    preferences: { theme: 'clinic-light', workspace: 'full' },
    ...catalogue,
  });
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Vzhled a rozhraní', () => {
  it('draws the server catalogue with its labels and help', async () => {
    render(<AccountPreferencesCard />);

    expect(await screen.findByLabelText(/Klid – teplá/)).toBeInTheDocument();
    expect(screen.getByText('Tlumené teplé odstíny.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Lékařské rozhraní/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Klinika – světlá/)).toBeChecked();
  });

  it('saves a chosen theme on the account and applies it here', async () => {
    vi.mocked(saveAccountPreferences).mockResolvedValue({
      preferences: { theme: 'contrast-dark', workspace: 'full' },
      ...catalogue,
    });
    render(<AccountPreferencesCard />);

    fireEvent.click(await screen.findByLabelText(/Kontrast – tmavá/));

    await waitFor(() => expect(saveAccountPreferences).toHaveBeenCalledWith({ theme: 'contrast-dark' }));
    await waitFor(() => expect(parsePreferences(preferencesSnapshot()).theme).toBe('contrast-dark'));
    expect(await screen.findByRole('status')).toHaveTextContent('Uloženo.');
  });

  it('saves the workspace on its own', async () => {
    vi.mocked(saveAccountPreferences).mockResolvedValue({
      preferences: { theme: 'clinic-light', workspace: 'doctor' },
      ...catalogue,
    });
    render(<AccountPreferencesCard />);

    fireEvent.click(await screen.findByLabelText(/Lékařské rozhraní/));

    await waitFor(() => expect(saveAccountPreferences).toHaveBeenCalledWith({ workspace: 'doctor' }));
    await waitFor(() => expect(parsePreferences(preferencesSnapshot()).workspace).toBe('doctor'));
  });

  it('says so when a save fails, and keeps the screen as it was', async () => {
    vi.mocked(saveAccountPreferences).mockRejectedValue(new Error('500'));
    render(<AccountPreferencesCard />);

    fireEvent.click(await screen.findByLabelText(/Tisk – černobílá/));

    expect(await screen.findByText(/nepodařilo uložit/)).toBeInTheDocument();
    expect(parsePreferences(preferencesSnapshot()).theme).toBe('clinic-light');
  });
});
