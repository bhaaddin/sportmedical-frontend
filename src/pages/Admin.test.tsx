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
    openingHours: 'pub.openingHours',
    siteUrl: 'pub.siteUrl',
  },
  OPENING_HOURS_MAX_LENGTH: 200,
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

  it('reads and saves the opening hours the web shows', async () => {
    readSettings.mockResolvedValue({ 'pub.siteName': 'SportMedical', 'pub.openingHours': 'Po–Pá 8–16' });
    const user = userEvent.setup();
    render(<Admin />);

    const field = await screen.findByLabelText('Otevírací doba (text pro web)');
    expect(field).toHaveValue('Po–Pá 8–16');
    await user.clear(field);
    await user.type(field, ' Po–So 7–19 ');
    await user.click(saveButton());

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ 'pub.openingHours': 'Po–So 7–19' }));
  });

  it('reads and saves the public address of the web (pub.siteUrl) as an origin', async () => {
    readSettings.mockResolvedValue({ 'pub.siteName': 'SportMedical', 'pub.siteUrl': 'https://www.sportmedical.cz' });
    const user = userEvent.setup();
    render(<Admin />);

    const field = await screen.findByLabelText('Veřejná adresa webu');
    expect(field).toHaveValue('https://www.sportmedical.cz');
    await user.clear(field);
    await user.type(field, 'klub.priklad.cz/cesta/');
    await user.click(saveButton());

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ 'pub.siteUrl': 'https://klub.priklad.cz' }));
  });

  it('an empty public address is saved empty; an unusable one is refused and nothing is saved', async () => {
    readSettings.mockResolvedValue({ 'pub.siteName': 'SportMedical' });
    const user = userEvent.setup();
    render(<Admin />);

    const field = await screen.findByLabelText('Veřejná adresa webu');
    await user.click(saveButton());
    expect(saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ 'pub.siteUrl': '' }));

    saveSettings.mockClear();
    await user.type(field, 'ne platná adresa');
    expect(await screen.findByText('Zadejte adresu ve tvaru https://www.priklad.cz.')).toBeInTheDocument();
    await user.click(saveButton());
    expect(saveSettings).not.toHaveBeenCalled();
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
