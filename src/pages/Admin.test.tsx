/*
 * Veřejný web a kontakty - the values the anonymous booking pages show.
 *
 * The fields open blank and are filled from what is stored. If that read
 * failed, Save stayed enabled and wrote the blanks over the clinic's name,
 * e-mail, phone and address, and switched online booking back on.
 *
 * What would have to break for these to fail: enabling Save before the stored
 * values are in, or failing to read them in silence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const readSettings = vi.fn();
const saveSettings = vi.fn();

vi.mock('../api/clinicSettings', () => ({
  readSettings,
  saveSettings,
  PUBLIC_CLINIC_KEYS: {
    name: 'pub.siteName',
    email: 'pub.contactEmail',
    phone: 'pub.contactPhone',
    address: 'pub.contactAddress',
    bookingEnabled: 'pub.bookingEnabled',
  },
}));
vi.mock('../components/CompanySettingsCard', () => ({ default: () => null }));

const { default: Admin } = await import('./Admin');

const saveButton = () => screen.getByRole('button', { name: /Uložit kontakty a rezervace/ });

beforeEach(() => {
  readSettings.mockReset();
  saveSettings.mockReset().mockResolvedValue(undefined);
});

describe('saving the public contacts', () => {
  it('saves what was read and edited', async () => {
    readSettings.mockResolvedValue({ 'pub.siteName': 'SportMedical', 'pub.bookingEnabled': 'false' });
    const user = userEvent.setup();
    render(<Admin />);

    expect(await screen.findByDisplayValue('SportMedical')).toBeInTheDocument();
    await user.click(saveButton());

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      'pub.siteName': 'SportMedical',
      'pub.bookingEnabled': 'false',
    }));
  });

  it('is not possible while the stored values have not been read', () => {
    readSettings.mockReturnValue(new Promise(() => {}));
    render(<Admin />);

    expect(saveButton()).toBeDisabled();
  });

  it('is not possible, and says so, when reading them failed', async () => {
    readSettings.mockRejectedValue(new Error('500'));
    render(<Admin />);

    expect(await screen.findByText(/Uložené kontakty se nepodařilo načíst/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
