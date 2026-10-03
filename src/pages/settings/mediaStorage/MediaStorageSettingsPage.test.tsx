/*
 * Úložiště médií (/nastaveni/uloziste-medii). What has to hold: the secret is write-only (never shown,
 * never prefilled, sent only when typed), the status "Nastaveno / Nenastaveno" is worked out from what
 * is saved (the contract has no connection test), Uložit lives only on a change, a refusal and a failed
 * load say what happened, and the screen holds together at 390 / 834 / 1440.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { isMediaStorageReady, parseMediaStorage } from '../../../api/mediaStorageSettings';
import { server } from '../siteContent/fakeServer';
import MediaStorageSettingsPage, { validateMediaStorage } from '../MediaStorageSettingsPage';

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  const { fakeClient } = await import('../siteContent/fakeServer');
  return { ...actual, default: fakeClient, client: fakeClient };
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/uloziste-medii']}>
        <MediaStorageSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const loaded = async () => {
  renderPage();
  await screen.findByLabelText('Cloud name');
};

const configured = { provider: 'cloudinary', enabled: true, cloudName: 'sportmedical', apiKey: '123456789', hasSecret: true, uploadPreset: 'web' };
const putBody = () => server.calls('put', '/api/v1/settings/media-storage').at(-1)?.body as Record<string, unknown>;

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  server.reset();
});

describe('layout at the three widths', () => {
  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ] as const)('%s: the form and the explanation are on the screen', async (device, width) => {
    setViewport(width);
    server.state.mediaStorage = { ...configured };
    await loaded();
    expect(document.querySelector('[data-layout]')?.getAttribute('data-layout')).toBe(device);
    expect(screen.getByRole('heading', { name: 'Úložiště médií' })).toBeInTheDocument();
    // the explanation sits in the frame's right column on a desktop and in the content below it
    expect(screen.getByText('K čemu to je')).toBeInTheDocument();
    expect(screen.getByText('Bezpečnost')).toBeInTheDocument();
    expect(screen.getByText('Nastaveno')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('tablet puts the form and the explanation in two columns; phone stacks the explanation above the form', async () => {
    setViewport(VIEWPORTS.tablet);
    await loaded();
    const tablet = document.querySelector('[data-layout="tablet"]') as HTMLElement;
    expect(within(tablet).getByLabelText('Cloud name')).toBeInTheDocument();
    expect(within(tablet).getByText('K čemu to je')).toBeInTheDocument();
  });

  it('phone: the explanation comes first, then the fields', async () => {
    setViewport(VIEWPORTS.phone);
    await loaded();
    const phone = document.querySelector('[data-layout="phone"]') as HTMLElement;
    const text = phone.textContent ?? '';
    expect(text.indexOf('K čemu to je')).toBeGreaterThan(-1);
    expect(text.indexOf('K čemu to je')).toBeLessThan(text.indexOf('Cloud name'));
    expect(within(phone).getByLabelText('Cloud name')).toBeInTheDocument();
  });
});

describe('what is saved', () => {
  it('shows the stored values, with the secret as "Uloženo ✓" and never as a value', async () => {
    server.state.mediaStorage = { ...configured };
    await loaded();
    expect(screen.getByLabelText('Cloud name')).toHaveValue('sportmedical');
    expect(screen.getByLabelText('API key')).toHaveValue('123456789');
    expect(screen.getByLabelText(/^Upload preset/)).toHaveValue('web');
    expect(screen.getByLabelText('Úložiště médií zapnuto')).toBeChecked();
    expect(screen.getByText('Uloženo ✓')).toBeInTheDocument();
    expect(screen.queryByLabelText('API secret')).toBeNull();
    expect(screen.getByRole('button', { name: 'Změnit' })).toBeInTheDocument();
  });

  it('an empty installation shows empty fields, a switched-off storage and "Nenastaveno" with what is missing', async () => {
    await loaded();
    expect(screen.getByLabelText('Cloud name')).toHaveValue('');
    expect(screen.getByLabelText('Úložiště médií zapnuto')).not.toBeChecked();
    expect(screen.getByText('Nenastaveno')).toBeInTheDocument();
    expect(screen.getByText(/je potřeba zapnout úložiště, vyplnit cloud name, uložit API secret/)).toBeInTheDocument();
    // no secret stored → the field is there at once, masked
    const secret = screen.getByLabelText('API secret');
    expect(secret).toHaveAttribute('type', 'password');
    expect(secret).toHaveValue('');
  });

  it('does not invent a connection test: there is no "Zkontrolovat spojení" and no request but the load', async () => {
    server.state.mediaStorage = { ...configured };
    await loaded();
    expect(screen.queryByRole('button', { name: /Zkontrolovat spojení/ })).toBeNull();
    expect(server.state.calls.filter((c) => c.method !== 'get')).toHaveLength(0);
  });
});

describe('the secret is write-only', () => {
  it('"Změnit" opens an empty masked field; leaving it empty keeps the stored secret out of the request', async () => {
    const user = userEvent.setup();
    server.state.mediaStorage = { ...configured };
    await loaded();

    await user.click(screen.getByRole('button', { name: 'Změnit' }));
    const secret = screen.getByLabelText('API secret');
    expect(secret).toHaveAttribute('type', 'password');
    expect(secret).toHaveValue('');
    expect(secret).toHaveAttribute('autocomplete', 'new-password');

    // change something else, save without typing a secret
    const preset = screen.getByLabelText(/^Upload preset/);
    await user.clear(preset);
    await user.type(preset, 'novy');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(server.calls('put')).toHaveLength(1));
    expect(putBody()).toEqual({ provider: 'cloudinary', enabled: true, cloudName: 'sportmedical', apiKey: '123456789', uploadPreset: 'novy' });
    expect('apiSecret' in putBody()).toBe(false);
  });

  it('a typed new secret goes out once and is gone from the screen after the save', async () => {
    const user = userEvent.setup();
    server.state.mediaStorage = { ...configured };
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Změnit' }));
    await user.type(screen.getByLabelText('API secret'), 'tajne-heslo-123');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(putBody()).toMatchObject({ apiSecret: 'tajne-heslo-123' }));
    await waitFor(() => expect(screen.getByText('Uloženo ✓')).toBeInTheDocument());
    expect(screen.queryByLabelText('API secret')).toBeNull();
    expect(document.body.innerHTML).not.toContain('tajne-heslo-123');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('"Ponechat uložený secret" closes the field and forgets what was typed', async () => {
    const user = userEvent.setup();
    server.state.mediaStorage = { ...configured };
    await loaded();
    await user.click(screen.getByRole('button', { name: 'Změnit' }));
    await user.type(screen.getByLabelText('API secret'), 'x');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Ponechat uložený secret' }));
    expect(screen.queryByLabelText('API secret')).toBeNull();
    expect(screen.getByText('Uloženo ✓')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });
});

describe('saving', () => {
  it('first-time setup: switch on, fill the fields and the secret, save → the exact payload, then "Nastaveno"', async () => {
    const user = userEvent.setup();
    await loaded();
    await user.click(screen.getByLabelText('Úložiště médií zapnuto'));
    await user.type(screen.getByLabelText('Cloud name'), ' sportmedical ');
    await user.type(screen.getByLabelText('API key'), '123456789');
    await user.type(screen.getByLabelText('API secret'), 's3cret');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() => expect(server.calls('put')).toHaveLength(1));
    expect(putBody()).toEqual({ provider: 'cloudinary', enabled: true, cloudName: 'sportmedical', apiKey: '123456789', uploadPreset: '', apiSecret: 's3cret' });
    await waitFor(() => expect(screen.getByText('Nastaveno')).toBeInTheDocument());
    expect(screen.getByText('Uloženo ✓')).toBeInTheDocument();
  });

  it('refuses a switched-on storage without cloud name, key or secret before the round trip, naming each', async () => {
    const user = userEvent.setup();
    await loaded();
    await user.click(screen.getByLabelText('Úložiště médií zapnuto'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Vyplňte cloud name/)).toBeInTheDocument();
    expect(screen.getByText('Vyplňte API key.')).toBeInTheDocument();
    expect(screen.getByText(/Vyplňte API secret/)).toBeInTheDocument();
    expect(server.calls('put')).toHaveLength(0);
  });

  it('switching off needs nothing else, and Zahodit puts the saved values back', async () => {
    const user = userEvent.setup();
    server.state.mediaStorage = { ...configured };
    await loaded();
    const cloud = screen.getByLabelText('Cloud name');
    await user.type(cloud, 'x');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(cloud).toHaveValue('sportmedical');
    expect(server.calls('put')).toHaveLength(0);

    await user.click(screen.getByLabelText('Úložiště médií zapnuto'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(putBody()).toMatchObject({ enabled: false }));
    await waitFor(() => expect(screen.getByText('Nenastaveno')).toBeInTheDocument());
  });

  it('shows the server\'s own sentence when it refuses, and keeps the form filled in', async () => {
    const user = userEvent.setup();
    server.state.mediaStorage = { ...configured };
    server.fail('put', '/api/v1/settings/media-storage', 400, { message: 'Cloudinary tyto údaje odmítla.', errors: { cloudName: ['Takový účet neexistuje.'] } });
    await loaded();
    const cloud = screen.getByLabelText('Cloud name');
    await user.clear(cloud);
    await user.type(cloud, 'spatne');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Cloudinary tyto údaje odmítla.')).toBeInTheDocument();
    expect(screen.getByText('Takový účet neexistuje.')).toBeInTheDocument();
    expect(cloud).toHaveValue('spatne');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });
});

describe('the status', () => {
  it('"Nastaveno" needs the switch on, a cloud name and a stored secret', () => {
    expect(isMediaStorageReady({ enabled: true, cloudName: 'x', hasSecret: true })).toBe(true);
    expect(isMediaStorageReady({ enabled: false, cloudName: 'x', hasSecret: true })).toBe(false);
    expect(isMediaStorageReady({ enabled: true, cloudName: '  ', hasSecret: true })).toBe(false);
    expect(isMediaStorageReady({ enabled: true, cloudName: 'x', hasSecret: false })).toBe(false);
  });

  it('shows the derived status of what is saved, not of what is being typed', async () => {
    const user = userEvent.setup();
    server.state.mediaStorage = { ...configured, enabled: false };
    await loaded();
    expect(screen.getByText('Nenastaveno')).toBeInTheDocument();
    expect(screen.getByText(/je potřeba zapnout úložiště\./)).toBeInTheDocument();
    await user.click(screen.getByLabelText('Úložiště médií zapnuto'));
    expect(screen.getByText('Nenastaveno')).toBeInTheDocument();
  });
});

describe('a failed load', () => {
  it('says what failed and retries on "Zkusit znovu", never a white screen', async () => {
    const user = userEvent.setup();
    server.fail('get', '/api/v1/settings/media-storage', 500, {});
    renderPage();
    expect(await screen.findByText('Nastavení úložiště médií se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Úložiště médií' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByLabelText('Cloud name')).toBeInTheDocument();
  });
});

describe('parsing and validation', () => {
  it('reads the contract tolerantly: nulls, a missing provider, unknown keys, never a secret', () => {
    expect(parseMediaStorage({ enabled: null, cloudName: null, apiKey: 'k', hasSecret: true, uploadPreset: null, apiSecret: 'LEAK', extra: 1 })).toEqual({
      provider: 'cloudinary', enabled: false, cloudName: '', apiKey: 'k', hasSecret: true, uploadPreset: '',
    });
    expect(parseMediaStorage({ value: { provider: 'cloudinary', enabled: true, cloudName: 'c', apiKey: 'k', hasSecret: false } }).enabled).toBe(true);
    expect(() => parseMediaStorage('nonsense')).toThrow();
  });

  it('requires nothing while the storage is off, and everything (secret only if none is stored) while it is on', () => {
    const draft = { enabled: false, cloudName: '', apiKey: '', uploadPreset: '' };
    expect(validateMediaStorage(draft, false, '')).toEqual({});
    expect(Object.keys(validateMediaStorage({ ...draft, enabled: true }, false, '')).sort()).toEqual(['apiKey', 'apiSecret', 'cloudName']);
    expect(Object.keys(validateMediaStorage({ ...draft, enabled: true }, true, ''))).toEqual(['cloudName', 'apiKey']);
    expect(validateMediaStorage({ enabled: true, cloudName: 'c', apiKey: 'k', uploadPreset: '' }, false, 's')).toEqual({});
  });
});
