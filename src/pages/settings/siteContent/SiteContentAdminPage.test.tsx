/*
 * "Média a texty" (/nastaveni/media-a-texty): the screen where staff change the public site.
 * The tests talk to the real API modules through an in-memory server (fakeServer.ts), at the three
 * widths. What has to hold: the layout of each device, the page list with its counters and search,
 * a text slot's edit / save / reset, an image's upload (happy path, 503, a wrong file), the grey
 * placeholder with the registry's caption, partners and FAQ, and the unsaved-changes guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { SLOTS_BY_PAGE } from '../../../site/siteSlots';
import { DEFAULT_FAQ, DEFAULT_PARTNERS } from '../../../site/defaults';
import { server } from './fakeServer';
import { buildPages, countSlots, placeholderSentence, type SlotPage } from './model';
import SiteContentAdminPage from '../SiteContentAdminPage';

vi.setConfig({ testTimeout: 20_000 });

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  const { fakeClient } = await import('./fakeServer');
  return { ...actual, default: fakeClient, client: fakeClient };
});

/* The slots the tests work on come from the registry, so renaming a key or a label there does not break them. */
const landing = SLOTS_BY_PAGE.landing;
const isShortText = (d: (typeof landing)[number]) =>
  d.kind === 'text' && d.multiline !== true && !(d.defaultText ?? '').includes('\n') && (d.defaultText ?? '').length <= 70;
const [textA, textB] = landing.filter(isShortText);
const imageDef = landing.find((d) => d.kind === 'image')!;
const slotPages = buildPages().filter((p): p is SlotPage => p.type === 'slots');

const Where = () => <output data-testid="where">{useLocation().pathname}</output>;

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
      <MemoryRouter initialEntries={['/nastaveni/media-a-texty']}>
        <SiteContentAdminPage />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const loaded = async () => {
  renderPage();
  await screen.findByRole('navigation', { name: 'Stránky webu' });
};

const cardOf = (key: string): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`[data-slot-card="${key}"]`);
  if (el === null) throw new Error(`no card for ${key}`);
  return el;
};

const jpg = () => new File(['x'], 'hero.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  server.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('layout at the three widths', () => {
  it.each([
    ['phone', VIEWPORTS.phone, 'chips', '1'],
    ['tablet', VIEWPORTS.tablet, 'list', '1'],
    ['desktop', VIEWPORTS.desktop, 'list', '2'],
  ] as const)('%s: page %s → %s navigation, %s column(s) of cards', async (device, width, nav, columns) => {
    setViewport(width);
    await loaded();
    expect(document.querySelector('[data-layout]')?.getAttribute('data-layout')).toBe(device);
    expect(screen.getByRole('navigation', { name: 'Stránky webu' })).toHaveAttribute('data-nav', nav);
    expect(document.querySelector('[data-columns]')?.getAttribute('data-columns')).toBe(columns);
    expect(screen.getByRole('heading', { name: 'Média a texty' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Hledat v textech a fotkách' })).toBeInTheDocument();
    // Save lives in the frame (pinned to the bottom on a phone) and is off until something changes.
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });
});

describe('page list, counters, search', () => {
  it('lists the pages of the registry, then Partneři and Časté otázky, each with filled / total', async () => {
    server.state.slots[textA.key] = { kind: 'text', text: 'Moje věta' };
    server.state.slots[imageDef.key] = { kind: 'image', mediaUrl: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg' };
    await loaded();

    const nav = screen.getByRole('navigation', { name: 'Stránky webu' });
    const first = slotPages[0];
    const counter = countSlots(first.slots, server.state.slots as never);
    expect(within(nav).getByRole('button', { name: new RegExp(`^${first.label}\\s*${counter.filled} / ${counter.total}$`) })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Partneři\s*0$/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /^Časté otázky\s*0$/ })).toBeInTheDocument();
    // the first page is open
    expect(within(nav).getByRole('button', { name: new RegExp(`^${first.label}`) })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the media and text counters of the open page and switches page on a click', async () => {
    const user = userEvent.setup();
    await loaded();
    const [first, second] = slotPages;
    const open = screen.getByRole('region', { name: first.label });
    const c = countSlots(first.slots, {});
    expect(within(open).getByText(`Fotky a videa: 0 z ${c.mediaTotal} · Vlastní texty: 0 z ${c.textTotal}`)).toBeInTheDocument();
    expect(document.querySelector(`[data-slot-card="${first.slots[0].key}"]`)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: new RegExp(`^${second.label}`) }));
    expect(screen.getByRole('region', { name: second.label })).toBeInTheDocument();
    expect(document.querySelector(`[data-slot-card="${first.slots[0].key}"]`)).toBeNull();
    expect(document.querySelector(`[data-slot-card="${second.slots[0].key}"]`)).not.toBeNull();
  });

  it('filters a page to photos and videos or to texts', async () => {
    const user = userEvent.setup();
    await loaded();
    await user.click(screen.getByRole('button', { name: /^Fotky a videa/ }));
    expect(document.querySelector(`[data-slot-card="${imageDef.key}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-slot-card="${textA.key}"]`)).toBeNull();
    await user.click(screen.getByRole('button', { name: /^Texty/ }));
    expect(document.querySelector(`[data-slot-card="${textA.key}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-slot-card="${imageDef.key}"]`)).toBeNull();
  });

  it('searches every page by label, key and default text, and says when nothing matches', async () => {
    const user = userEvent.setup();
    await loaded();
    const search = screen.getByRole('textbox', { name: 'Hledat v textech a fotkách' });

    await user.click(search);
    await user.paste(imageDef.key);
    expect(screen.getByRole('region', { name: 'Výsledky hledání' })).toBeInTheDocument();
    expect(document.querySelector(`[data-slot-card="${imageDef.key}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-slot-card="${textA.key}"]`)).toBeNull();

    await user.clear(search);
    await user.paste('zzzneexistuje');
    expect(screen.getByText('Nic neodpovídá „zzzneexistuje“.')).toBeInTheDocument();

    // the nav leaves search mode
    await user.click(screen.getByRole('button', { name: new RegExp(`^${slotPages[0].label}`) }));
    expect(search).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Výsledky hledání' })).toBeNull();
  });
});

describe('text slots', () => {
  it('shows the default text under the editor and the editor holding the current text', async () => {
    await loaded();
    const card = cardOf(textA.key);
    expect(within(card).getByRole('textbox', { name: textA.label })).toHaveValue(textA.defaultText);
    expect(within(card).getByText('Výchozí text')).toBeInTheDocument();
    expect(within(card).getByText('Výchozí')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Vrátit výchozí' })).toBeDisabled();
  });

  it('saves an edit with the card button: PUT { text }, then who changed it and when', async () => {
    const user = userEvent.setup();
    await loaded();
    const card = cardOf(textA.key);
    const field = within(card).getByRole('textbox', { name: textA.label });
    await user.clear(field);
    await user.type(field, 'Nová věta');

    expect(within(card).getByText('Neuloženo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(within(card).getByRole('button', { name: 'Uložit text' }));

    await waitFor(() => expect(server.calls('put', `/slots/${textA.key}`)).toHaveLength(1));
    expect(server.calls('put', `/slots/${textA.key}`)[0].body).toEqual({ text: 'Nová věta' });
    await waitFor(() => expect(within(card).getByText('Upraveno')).toBeInTheDocument());
    expect(within(card).queryByText('Neuloženo')).toBeNull();
    await waitFor(() => expect(within(card).getByText(/Změnil Jana Nováková · 3\. 10\. 2026 14:05/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('saves every edited card with the frame button in one go', async () => {
    const user = userEvent.setup();
    await loaded();
    for (const [def, text] of [[textA, 'Jedna'], [textB, 'Dvě']] as const) {
      const field = within(cardOf(def.key)).getByRole('textbox', { name: def.label });
      await user.clear(field);
      await user.type(field, text);
    }
    await user.click(screen.getByRole('button', { name: 'Uložit (2)' }));
    await waitFor(() => expect(server.calls('put', '/slots/')).toHaveLength(2));
    expect(server.calls('put', `/slots/${textA.key}`)[0].body).toEqual({ text: 'Jedna' });
    expect(server.calls('put', `/slots/${textB.key}`)[0].body).toEqual({ text: 'Dvě' });
  });

  it('puts the saved text back with Zahodit, without a request', async () => {
    const user = userEvent.setup();
    await loaded();
    const field = within(cardOf(textA.key)).getByRole('textbox', { name: textA.label });
    await user.type(field, ' navíc');
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(field).toHaveValue(textA.defaultText);
    expect(server.calls('put')).toHaveLength(0);
  });

  it('refuses an empty text before the round trip', async () => {
    const user = userEvent.setup();
    await loaded();
    const card = cardOf(textA.key);
    await user.clear(within(card).getByRole('textbox', { name: textA.label }));
    await user.click(within(card).getByRole('button', { name: 'Uložit text' }));
    expect(within(card).getByRole('alert')).toHaveTextContent('Text nesmí být prázdný.');
    expect(server.calls('put')).toHaveLength(0);
  });

  it('rolls back and says why when the server refuses, keeping what was typed', async () => {
    const user = userEvent.setup();
    server.fail('put', '/slots/', 500, { message: 'Databáze neodpovídá.' });
    await loaded();
    const card = cardOf(textA.key);
    const field = within(card).getByRole('textbox', { name: textA.label });
    await user.clear(field);
    await user.type(field, 'Něco');
    await user.click(within(card).getByRole('button', { name: 'Uložit text' }));

    expect(await within(card).findByText('Databáze neodpovídá.')).toBeInTheDocument();
    expect(field).toHaveValue('Něco');
    expect(within(card).getByText('Neuloženo')).toBeInTheDocument();
    expect(within(card).getByText('Výchozí')).toBeInTheDocument();
  });

  it('"Vrátit výchozí" asks, then DELETEs the slot and shows the default again', async () => {
    const user = userEvent.setup();
    server.state.slots[textA.key] = { kind: 'text', text: 'Moje věta', updatedBy: 'Petr', updatedAtUtc: '2026-10-02T08:00:00Z' };
    await loaded();
    const card = cardOf(textA.key);
    expect(within(card).getByRole('textbox', { name: textA.label })).toHaveValue('Moje věta');
    expect(within(card).getByText(/Změnil Petr · 2\. 10\. 2026 10:00/)).toBeInTheDocument();

    await user.click(within(card).getByRole('button', { name: 'Vrátit výchozí' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Vrátit výchozí text?');
    await user.click(within(dialog).getByRole('button', { name: 'Ano, vrátit' }));

    await waitFor(() => expect(server.calls('delete', `/slots/${textA.key}`)).toHaveLength(1));
    await waitFor(() => expect(within(card).getByRole('textbox', { name: textA.label })).toHaveValue(textA.defaultText));
    expect(within(card).getByText('Výchozí')).toBeInTheDocument();
  });

  it('links each card to its public page', async () => {
    await loaded();
    const link = within(cardOf(textA.key)).getByRole('link', { name: `Zobrazit na webu: ${textA.label}` });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /Zobrazit stránku .* na webu/ })).toHaveAttribute('href', '/');
  });
});

describe('image slots', () => {
  it('holds a grey placeholder with the registry\'s sentence, caption and recommended size until a file arrives', async () => {
    await loaded();
    const card = cardOf(imageDef.key);
    const placeholder = card.querySelector('[data-slot-preview="placeholder"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder).toHaveTextContent(placeholderSentence(imageDef));
    expect(placeholder).toHaveTextContent(/^Sem patří fotka — doporučeno \d+ × \d+ px/);
    expect(placeholder).toHaveTextContent(`Na webu: ${imageDef.caption}`);
    expect(within(card).getByText(`Doporučená velikost: ${imageDef.recommended}`)).toBeInTheDocument();
    expect(within(card).getByText('Čeká na soubor')).toBeInTheDocument();
    expect(within(card).getByText('Nahrát')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Odstranit' })).toBeNull();
    expect(within(card).queryByLabelText('Popis fotky (alt)')).toBeNull();
  });

  it('uploads a file: POST multipart with the slot key, then PUT { assetId }, then shows it with alt and Odstranit', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await loaded();
    const card = cardOf(imageDef.key);
    await user.upload(within(card).getByLabelText(`Soubor pro ${imageDef.label}`), jpg());

    await waitFor(() => expect(card.querySelector('[data-slot-preview="file"]')).not.toBeNull());
    const post = server.calls('post', '/api/v1/media');
    expect(post).toHaveLength(1);
    const form = post[0].body as FormData;
    expect((form.get('file') as File).name).toBe('hero.jpg');
    expect(form.get('slotKey')).toBe(imageDef.key);
    expect(server.calls('put', `/slots/${imageDef.key}`)[0].body).toEqual({ assetId: 'asset-1' });

    expect(within(card).getByText('Nahráno')).toBeInTheDocument();
    expect(within(card).getByText('Nahráno: 1600 × 900 px')).toBeInTheDocument();
    expect(within(card).getByRole('img')).toHaveAttribute('alt', imageDef.label);
    expect(within(card).getByText('Nahradit')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Odstranit' })).toBeInTheDocument();
    expect(within(card).getByLabelText('Popis fotky (alt)')).toBeInTheDocument();
  });

  it('saves an alt text with PUT { alt }', async () => {
    const user = userEvent.setup();
    server.state.slots[imageDef.key] = { kind: 'image', mediaUrl: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', width: 1600, height: 900 };
    await loaded();
    const card = cardOf(imageDef.key);
    await user.type(within(card).getByLabelText('Popis fotky (alt)'), 'Sportovec na ergometru');
    await user.click(within(card).getByRole('button', { name: 'Uložit popis' }));
    await waitFor(() => expect(server.calls('put', `/slots/${imageDef.key}`)).toHaveLength(1));
    expect(server.calls('put', `/slots/${imageDef.key}`)[0].body).toEqual({ alt: 'Sportovec na ergometru' });
    await waitFor(() => expect(within(card).getByRole('img')).toHaveAttribute('alt', 'Sportovec na ergometru'));
  });

  it('503 "Úložiště médií není nastavené" is shown with a link to the storage settings', async () => {
    const user = userEvent.setup({ applyAccept: false });
    server.fail('post', '/api/v1/media', 503, { message: 'Úložiště médií není nastavené.' });
    await loaded();
    const card = cardOf(imageDef.key);
    await user.upload(within(card).getByLabelText(`Soubor pro ${imageDef.label}`), jpg());

    const alert = await within(card).findByRole('alert');
    expect(alert).toHaveTextContent('Úložiště médií není nastavené.');
    expect(within(alert).getByRole('link', { name: 'Nastavit úložiště médií' })).toHaveAttribute('href', '/nastaveni/uloziste-medii');
    expect(card.querySelector('[data-slot-preview="placeholder"]')).not.toBeNull();
    expect(server.calls('put', '/slots/')).toHaveLength(0);
  });

  it('refuses a wrong file and an oversized one in the browser, with a sentence and no request', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await loaded();
    const card = cardOf(imageDef.key);
    const input = within(card).getByLabelText(`Soubor pro ${imageDef.label}`);

    await user.upload(input, new File(['%PDF'], 'smlouva.pdf', { type: 'application/pdf' }));
    expect(await within(card).findByRole('alert')).toHaveTextContent('Soubor „smlouva.pdf“ sem nepatří. Tady má být fotka ve formátu JPG, PNG, WebP nebo AVIF.');

    const big = new File(['x'], 'velka.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 });
    await user.upload(input, big);
    await waitFor(() => expect(within(card).getByRole('alert')).toHaveTextContent('Soubor „velka.jpg“ má 20,0'));
    expect(server.calls('post')).toHaveLength(0);
  });

  it('says so when the file was stored but could not be put in its place, and cleans up the orphan', async () => {
    const user = userEvent.setup({ applyAccept: false });
    server.fail('put', `/slots/${imageDef.key}`, 500, {});
    await loaded();
    const card = cardOf(imageDef.key);
    await user.upload(within(card).getByLabelText(`Soubor pro ${imageDef.label}`), jpg());
    expect(await within(card).findByRole('alert')).toHaveTextContent('Soubor se nahrál, ale nepodařilo se ho vložit na jeho místo.');
    await waitFor(() => expect(server.calls('delete', '/api/v1/media/asset-1')).toHaveLength(1));
  });

  it('"Odstranit" asks, then DELETEs the slot and the placeholder is back', async () => {
    const user = userEvent.setup();
    server.state.slots[imageDef.key] = { kind: 'image', mediaUrl: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg' };
    await loaded();
    const card = cardOf(imageDef.key);
    await user.click(within(card).getByRole('button', { name: 'Odstranit' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ano, odstranit' }));
    await waitFor(() => expect(server.calls('delete', `/slots/${imageDef.key}`)).toHaveLength(1));
    await waitFor(() => expect(card.querySelector('[data-slot-preview="placeholder"]')).not.toBeNull());
  });

  it('on a phone the upload button is a full-size target (min height 44)', async () => {
    setViewport(VIEWPORTS.phone);
    await loaded();
    const label = within(cardOf(imageDef.key)).getByLabelText(`Soubor pro ${imageDef.label}`).closest('label');
    expect(label).not.toBeNull();
    expect(getComputedStyle(label as HTMLElement).minHeight).toBe('44px');
  });
});

describe('partners', () => {
  const alfa = { id: 'p1', name: 'Alfa', sport: 'Florbal', description: '', url: 'https://alfa.cz', sort: 1 };
  const beta = { id: 'p2', name: 'Beta', sport: '', description: '', url: '', sort: 2 };
  const openPartners = async (user: ReturnType<typeof userEvent.setup>) => {
    await loaded();
    await user.click(screen.getByRole('button', { name: /^Partneři/ }));
    return screen.getByRole('region', { name: 'Partneři' });
  };
  const names = (list: HTMLElement) => within(list).getAllByRole('listitem').map((li) => within(li).getAllByText(/^(Alfa|Beta|Gama)$/)[0].textContent);

  it('lists them with sport and web, and says a missing logo shows as text', async () => {
    const user = userEvent.setup();
    server.state.partners = [alfa, beta];
    const section = await openPartners(user);
    expect(within(section).getByText('Florbal · https://alfa.cz')).toBeInTheDocument();
    expect(within(section).getAllByText('Logo zatím chybí — zobrazí se text.')).toHaveLength(2);
  });

  it('adds a partner: validates, POSTs with the next sort, lists it', async () => {
    const user = userEvent.setup();
    server.state.partners = [alfa, beta];
    const section = await openPartners(user);
    await user.click(within(section).getByRole('button', { name: 'Přidat partnera' }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText(/^Web/), 'alfa');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit partnera' }));
    expect(within(dialog).getByText('Napište název partnera.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Adresa webu má začínat https:\/\//)).toBeInTheDocument();
    expect(server.calls('post')).toHaveLength(0);

    await user.type(within(dialog).getByLabelText(/^Název/), 'Gama');
    await user.clear(within(dialog).getByLabelText(/^Web/));
    await user.type(within(dialog).getByLabelText(/^Web/), 'https://gama.cz');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit partnera' }));

    await waitFor(() => expect(server.calls('post', '/partners')).toHaveLength(1));
    expect(server.calls('post', '/partners')[0].body).toEqual({ name: 'Gama', sport: '', description: '', url: 'https://gama.cz', sort: 3 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(names(within(section).getByRole('list', { name: 'Seznam partnerů' }))).toEqual(['Alfa', 'Beta', 'Gama']);
  });

  it('reorders with the arrows: PUTs the two whose sort changed and shows the new order', async () => {
    const user = userEvent.setup();
    server.state.partners = [alfa, beta];
    const section = await openPartners(user);
    await user.click(within(section).getByRole('button', { name: 'Posunout níž: Alfa' }));

    await waitFor(() => expect(server.calls('put', '/partners/')).toHaveLength(2));
    expect(server.calls('put', '/partners/p1')[0].body).toMatchObject({ name: 'Alfa', sort: 2 });
    expect(server.calls('put', '/partners/p2')[0].body).toMatchObject({ name: 'Beta', sort: 1 });
    await waitFor(() => expect(names(within(section).getByRole('list', { name: 'Seznam partnerů' }))).toEqual(['Beta', 'Alfa']));
    expect(within(section).getByRole('button', { name: 'Posunout výš: Beta' })).toBeDisabled();
    expect(within(section).getByRole('button', { name: 'Posunout níž: Alfa' })).toBeDisabled();
  });

  it('edits a partner and uploads a logo, which is sent as logoAssetId', async () => {
    const user = userEvent.setup({ applyAccept: false });
    server.state.partners = [alfa, beta];
    const section = await openPartners(user);
    await user.click(within(section).getByRole('button', { name: 'Upravit partnera Beta' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Logo zatím chybí — zobrazí se text.')).toBeInTheDocument();

    await user.upload(within(dialog).getByLabelText('Soubor pro logo partnera Beta'), new File(['x'], 'logo.png', { type: 'image/png' }));
    await waitFor(() => expect(within(dialog).getByRole('img', { name: 'Logo: Beta' })).toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Uložit partnera' }));

    await waitFor(() => expect(server.calls('put', '/partners/p2')).toHaveLength(1));
    expect(server.calls('put', '/partners/p2')[0].body).toMatchObject({ name: 'Beta', logoAssetId: 'asset-1' });
    await waitFor(() => expect(within(section).getByRole('img', { name: 'Logo: Beta' })).toBeInTheDocument());
    expect(within(section).getAllByText('Logo zatím chybí — zobrazí se text.')).toHaveLength(1);
  });

  it('deletes a partner after asking', async () => {
    const user = userEvent.setup();
    server.state.partners = [alfa, beta];
    const section = await openPartners(user);
    await user.click(within(section).getByRole('button', { name: 'Smazat partnera Alfa' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Smazat partnera „Alfa“?');
    await user.click(within(dialog).getByRole('button', { name: 'Ano, smazat' }));
    await waitFor(() => expect(server.calls('delete', '/partners/p1')).toHaveLength(1));
    await waitFor(() => expect(within(section).queryByText('Alfa')).toBeNull());
  });

  it('shows a refused save inside the dialog and keeps it open', async () => {
    const user = userEvent.setup();
    server.fail('post', '/partners', 400, { message: 'Název už existuje.' });
    const section = await openPartners(user);
    await user.click(within(section).getByRole('button', { name: 'Přidat partnera' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Název/), 'Alfa');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit partnera' }));
    expect(await within(dialog).findByText('Název už existuje.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('while the list is empty offers to take over the defaults, so the first partner does not replace them', async () => {
    const user = userEvent.setup();
    const section = await openPartners(user);
    expect(within(section).getByText(new RegExp(`výchozí seznam ${DEFAULT_PARTNERS.length} klubů`))).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Převzít výchozí seznam' }));
    await waitFor(() => expect(server.calls('post', '/partners')).toHaveLength(DEFAULT_PARTNERS.length), { timeout: 4000 });
    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(DEFAULT_PARTNERS.length));
  });
});

describe('FAQ', () => {
  const q1 = { id: 'f1', question: 'Jak se objednám?', answer: 'Online.', sort: 1 };
  const q2 = { id: 'f2', question: 'Kolik to stojí?', answer: 'Podle ceníku.', sort: 2 };
  const openFaq = async (user: ReturnType<typeof userEvent.setup>) => {
    await loaded();
    await user.click(screen.getByRole('button', { name: /^Časté otázky/ }));
    return screen.getByRole('region', { name: 'Časté otázky' });
  };

  it('edits a question and answer with PUT', async () => {
    const user = userEvent.setup();
    server.state.faq = [q1, q2];
    const section = await openFaq(user);
    await user.click(within(section).getByRole('button', { name: 'Upravit otázku: Jak se objednám?' }));
    const dialog = await screen.findByRole('dialog');
    const answer = within(dialog).getByLabelText(/^Odpověď/);
    await user.clear(answer);
    await user.type(answer, 'Přes web nebo telefonicky.');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit otázku' }));

    await waitFor(() => expect(server.calls('put', '/faq/f1')).toHaveLength(1));
    expect(server.calls('put', '/faq/f1')[0].body).toEqual({ question: 'Jak se objednám?', answer: 'Přes web nebo telefonicky.', sort: 1 });
    await waitFor(() => expect(within(section).getByText('Přes web nebo telefonicky.')).toBeInTheDocument());
  });

  it('adds a question (both fields required), reorders and deletes', async () => {
    const user = userEvent.setup();
    server.state.faq = [q1, q2];
    const section = await openFaq(user);

    await user.click(within(section).getByRole('button', { name: 'Přidat otázku' }));
    let dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit otázku' }));
    expect(within(dialog).getByText('Napište otázku.')).toBeInTheDocument();
    expect(within(dialog).getByText('Napište odpověď.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Otázka/), 'Kde jste?');
    await user.type(within(dialog).getByLabelText(/^Odpověď/), 'V Praze 4.');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit otázku' }));
    await waitFor(() => expect(server.calls('post', '/faq')[0]?.body).toEqual({ question: 'Kde jste?', answer: 'V Praze 4.', sort: 3 }));
    await waitFor(() => expect(within(section).getByText('Kde jste?')).toBeInTheDocument());

    await user.click(within(section).getByRole('button', { name: 'Posunout výš: Kolik to stojí?' }));
    await waitFor(() => expect(server.calls('put', '/faq/')).toHaveLength(2));
    expect(server.calls('put', '/faq/f2')[0].body).toEqual({ question: 'Kolik to stojí?', answer: 'Podle ceníku.', sort: 1 });

    await user.click(within(section).getByRole('button', { name: 'Smazat otázku: Jak se objednám?' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Ano, smazat' }));
    await waitFor(() => expect(server.calls('delete', '/faq/f1')).toHaveLength(1));
    await waitFor(() => expect(within(section).queryByText('Jak se objednám?')).toBeNull());
  });

  it('while the list is empty offers to take over the defaults', async () => {
    const user = userEvent.setup();
    const section = await openFaq(user);
    expect(within(section).getByText(new RegExp(`web ukazuje výchozích ${DEFAULT_FAQ.length}`))).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Převzít výchozí otázky' }));
    await waitFor(() => expect(server.calls('post', '/faq')).toHaveLength(DEFAULT_FAQ.length), { timeout: 4000 });
  });
});

describe('unsaved changes', () => {
  it('asks before a link inside the app is followed, and stays when the answer is no', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await loaded();
    await user.type(within(cardOf(textA.key)).getByRole('textbox', { name: textA.label }), ' x');

    await user.click(screen.getByRole('link', { name: 'Úložiště médií' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where')).toHaveTextContent('/nastaveni/media-a-texty');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('link', { name: 'Úložiště médií' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/nastaveni/uloziste-medii');
  });

  it('does not ask when nothing is unsaved, and the browser prompt is armed only while something is', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await loaded();

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(within(cardOf(textA.key)).getByRole('textbox', { name: textA.label }), ' x');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
    await user.click(screen.getByRole('link', { name: 'Úložiště médií' }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps a draft when you look at another page and come back', async () => {
    const user = userEvent.setup();
    await loaded();
    await user.type(within(cardOf(textA.key)).getByRole('textbox', { name: textA.label }), ' x');
    await user.click(screen.getByRole('button', { name: /^Partneři/ }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^${slotPages[0].label}`) }));
    expect(within(cardOf(textA.key)).getByRole('textbox', { name: textA.label })).toHaveValue(`${textA.defaultText} x`);
  });
});

describe('a failed load', () => {
  it('says what failed and retries on "Zkusit znovu", never a white screen', async () => {
    const user = userEvent.setup();
    server.fail('get', '/api/v1/site-content', 500, {});
    renderPage();
    expect(await screen.findByText('Média a texty se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Média a texty' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('navigation', { name: 'Stránky webu' })).toBeInTheDocument();
  });
});
