import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { VIEWPORTS } from '../../../test/viewport';
import { EMPTY_BOOTSTRAP, normalizeBootstrap } from '../../data';
import { render as renderToHtml } from '../../entry-server';
import { renderWeb } from '../../testUtils';
import { SLOT_KEY_PATTERN, SLOT_REGISTRY, slotDef } from '../../../site/siteSlots';
import DokumentyPage from '../DokumentyPage';
import KontaktPage from '../KontaktPage';
import ONasPage from '../ONasPage';
import KlubyPage, { ClubLinkSection } from '../KlubyPage';

const get = vi.fn();
vi.mock('../../http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../http')>();
  return { ...actual, webHttp: { get: (...args: unknown[]) => get(...args) } };
});

/* Every slot key a page asks for must be in the registry (otherwise the admin cannot edit it and
   the text would be empty). The spy records the keys while the pages render. */
const askedKeys = new Set<string>();
vi.mock('../../../api/siteContent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/siteContent')>();
  return {
    ...actual,
    useSlot: (key: string, fallback?: string) => {
      askedKeys.add(key);
      return actual.useSlot(key, fallback);
    },
  };
});

const serverDown = () => get.mockRejectedValue(new Error('Network Error'));

beforeEach(() => {
  get.mockReset();
  askedKeys.clear();
  serverDown();
});
afterEach(cleanup);

const widths = [
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const;

const h = (level: number, name: string | RegExp) => screen.getByRole('heading', { level, name });

describe.each(widths)('the company pages at %s (%i px)', (_name, width) => {
  it('Dokumenty: the H1, three sections, downloadable files and the "Připravujeme" ones', () => {
    const { container } = renderWeb(<DokumentyPage />, { width });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, 'Co si přinést a co vyplnit')).toBeInTheDocument();
    for (const title of ['Povinné před vyšetřením', 'Informace k jednotlivým vyšetřením', 'Pro kluby']) expect(h(2, title)).toBeInTheDocument();

    const gdpr = screen.getByRole('link', { name: /Souhlas pacienta \(GDPR\)/ });
    expect(gdpr).toHaveAttribute('href', expect.stringMatching(/^https:\/\/.+GDPR_final\.pdf/));
    expect(gdpr).toHaveAttribute('target', '_blank');
    expect(gdpr).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(gdpr).getByText('PDF')).toBeInTheDocument();

    // A document with no file yet is not a link.
    expect(screen.queryByRole('link', { name: /Informovaný souhlas/ })).toBeNull();
    expect(screen.getByText('Informovaný souhlas s vyšetřením')).toBeInTheDocument();
    expect(screen.getAllByText('Připravujeme').length).toBeGreaterThanOrEqual(2);

    // The club how-to is a page of this site; the portal button leaves for the application.
    expect(screen.getByRole('link', { name: /Hromadná objednávka/ })).toHaveAttribute('href', '/kluby');
    expect(screen.getByRole('link', { name: 'Otevřít portál' })).toHaveAttribute('href', '/portal/prihlaseni');
    expect(container.querySelector('[data-slot="dokumenty.hero.photo"]')).not.toBeNull();
    expect(screen.getByText('[FOTO: dokumenty na recepci]')).toBeInTheDocument();
  });

  it('Dokumenty: a file link the admin pastes replaces "Připravujeme"; a non-http one does not', async () => {
    const siteContent = {
      version: 'v1',
      partners: [],
      faq: [],
      slots: {
        'dokumenty.required.informovany.url': { kind: 'text', text: 'https://files.example/souhlas.pdf' },
        'dokumenty.guides.inbody-vysledky.url': { kind: 'text', text: 'javascript:alert(1)' },
      },
    };
    renderWeb(<DokumentyPage />, { width, seed: normalizeBootstrap({ siteContent }, 1) });
    expect(screen.getByRole('link', { name: /Informovaný souhlas/ })).toHaveAttribute('href', 'https://files.example/souhlas.pdf');
    expect(screen.queryByRole('link', { name: /Jak číst výsledky InBody/ })).toBeNull();
    await waitFor(() => { expect(get).toHaveBeenCalled(); });
  });

  it('Kontakt: address, phone, e-mail, hours, directions, billing — and a Mapy.cz link, no iframe, no form', async () => {
    const { container } = renderWeb(<KontaktPage />, { width });
    await waitFor(() => { expect(get).toHaveBeenCalled(); });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, 'Najdete nás v Michli')).toBeInTheDocument();
    for (const title of ['Jak se k nám dostanete', 'Otevírací doba', 'Máte dotaz?', 'Fakturační údaje']) expect(h(2, title)).toBeInTheDocument();
    expect(h(3, 'Metro')).toBeInTheDocument();

    // No API answer: the footer slots' defaults, as links.
    expect(screen.getAllByRole('link', { name: /606 785 271/ })[0]).toHaveAttribute('href', 'tel:+420606785271');
    expect(screen.getAllByRole('link', { name: 'recepce@sportmedical-diagnostics.cz' })[0]).toHaveAttribute('href', 'mailto:recepce@sportmedical-diagnostics.cz');
    expect(screen.getAllByText('Jihlavská 1558/21').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Po–Pá')).toBeInTheDocument();
    expect(screen.getByText('zavřeno')).toBeInTheDocument();
    expect(screen.getByText('23351632')).toBeInTheDocument();

    const map = screen.getByRole('link', { name: /Otevřít na Mapy\.cz/ });
    expect(map.getAttribute('href')).toMatch(/^https:\/\/mapy\.cz\/zakladni\?q=/);
    expect(map).toHaveAttribute('target', '_blank');
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('#poptavka')).not.toBeNull();
    expect(screen.getByText('[FOTO: Jihlavská 1558/21, Praha 4 — Michle]')).toBeInTheDocument();
  });

  it("Kontakt: the clinic's own settings win over the slot defaults", async () => {
    const clinic = {
      name: 'Klinika',
      phone: '+420 111 222 333',
      email: 'ahoj@klinika.example',
      address: 'Nová 5\n110 00 Praha 1',
      openingHours: 'Po–Čt 9:00–17:00 · Pá zavřeno',
    };
    renderWeb(<KontaktPage />, { width, seed: normalizeBootstrap({ clinic }, 1) });
    await waitFor(() => { expect(get).toHaveBeenCalled(); });

    expect(screen.getAllByRole('link', { name: /\+420 111 222 333/ })[0]).toHaveAttribute('href', 'tel:+420111222333');
    expect(screen.getAllByRole('link', { name: 'ahoj@klinika.example' })[0]).toHaveAttribute('href', 'mailto:ahoj@klinika.example');
    expect(screen.getByText('Nová 5')).toBeInTheDocument();
    expect(screen.getByText('Po–Čt')).toBeInTheDocument();
    expect(screen.getByText('9:00–17:00')).toBeInTheDocument();
    expect(screen.getByText('Pá')).toBeInTheDocument();
    // None of the defaults leak through where the clinic has its own value.
    expect(screen.queryByText('606 785 271')).toBeNull();
    expect(screen.queryByText('Jihlavská 1558/21')).toBeNull();
    expect(screen.getByRole('link', { name: /Otevřít na Mapy\.cz/ }).getAttribute('href')).toContain(encodeURIComponent('Nová 5, 110 00 Praha 1'));
    // The address does not name the building, so the building note is shown.
    expect(screen.getByText('Budova GreenLine, 5. patro')).toBeInTheDocument();
  });

  it('O nás: the clinic, values, gallery, team, equipment, partners (as text) and the mission', () => {
    const { container } = renderWeb(<ONasPage />, { width });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, 'Měřitelná přidaná hodnota')).toBeInTheDocument();
    for (const title of ['Čím se řídíme', 'Klinika uvnitř', 'Tým kliniky', 'Na čem měříme', 'Komu sloužíme', 'Nový pohled na sportovní medicínu a diagnostiku']) {
      expect(h(2, title)).toBeInTheDocument();
    }
    expect(h(3, 'Odborný tým')).toBeInTheDocument();
    expect(h(3, 'InBody 770')).toBeInTheDocument();
    expect(h(3, 'HumanTrak')).toBeInTheDocument();
    // Team placeholders and the hero photo placeholder; partners as text.
    expect(screen.getAllByText('[Jméno a příjmení]')).toHaveLength(4);
    expect(screen.getByText('[FOTO: tým kliniky]')).toBeInTheDocument();
    expect(screen.getAllByText('Black Angels').length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll('[data-slot-state="placeholder"]').length).toBeGreaterThanOrEqual(13);
    expect(screen.getAllByRole('link', { name: 'Objednat termín' })[0]).toHaveAttribute('href', '/objednat');
  });

  it('Pro kluby: the offer, #mam-odkaz with its input, the steps and the enquiry — and no discount number without tiers', () => {
    const { container } = renderWeb(<KlubyPage />, { width });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, 'Přijedeme za vámi do klubu')).toBeInTheDocument();
    for (const title of ['Podmínky výjezdu', 'Co z toho klub má', 'Jak to funguje', 'Mám odkaz od klubu', 'Nezávazná poptávka']) expect(h(2, title)).toBeInTheDocument();
    expect(h(3, 'Poptávka')).toBeInTheDocument();
    expect(h(3, 'Zvýhodněná cena')).toBeInTheDocument();

    const anchor = container.querySelector('#mam-odkaz');
    expect(anchor).not.toBeNull();
    expect(within(anchor as HTMLElement).getByLabelText('Odkaz od klubu')).toBeInTheDocument();
    expect(within(anchor as HTMLElement).getByRole('button', { name: 'Pokračovat k registraci' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Mám odkaz od klubu' })[0]).toHaveAttribute('href', '#mam-odkaz');
    expect(screen.getAllByRole('link', { name: 'Nezávazná poptávka' })[0]).toHaveAttribute('href', '/kontakt#poptavka');
    // The server publishes no tiers: no percentage anywhere, no tier table.
    expect(container.textContent).not.toMatch(/\d\s*%/);
    expect(screen.queryByText('Sleva podle počtu osob')).toBeNull();
  });
});

describe('Pro kluby — the discount', () => {
  it('shows the tiers and the best one exactly as the server publishes them', async () => {
    get.mockImplementation((url: string) => (
      url === '/api/public/discount-tiers'
        ? Promise.resolve({ data: [{ minPersons: 4, percent: 5 }, { minPersons: 10, percent: 15 }] })
        : Promise.reject(new Error('Network Error'))
    ));
    renderWeb(<KlubyPage />);
    await waitFor(() => { expect(screen.getByText('Sleva podle počtu osob')).toBeInTheDocument(); });
    const rows = within(screen.getByText('Sleva podle počtu osob').closest('section') as HTMLElement).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent?.replace(/ /g, ' '))).toEqual(['od 4 osob−5 %', 'od 10 osob−15 %']);
    // The best tier is the big number of the "Zvýhodněná cena" card.
    const card = screen.getByRole('heading', { level: 3, name: 'Zvýhodněná cena' }).closest('li') as HTMLElement;
    expect(card.textContent?.replace(/ /g, ' ')).toContain('−15 %');
    expect(screen.getByText(/^Od 10 osob\./)).toBeInTheDocument();
  });
});

describe('"Mám odkaz od klubu"', () => {
  const setup = () => {
    const navigate = vi.fn();
    renderWeb(<ClubLinkSection navigate={navigate} />);
    const input = screen.getByLabelText('Odkaz od klubu') as HTMLInputElement;
    const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Pokračovat k registraci' }));
    return { navigate, input, submit };
  };

  it('opens the registration of a pasted full link', () => {
    const { navigate, input, submit } = setup();
    fireEvent.change(input, { target: { value: 'https://app.sportmedical.example/klub/abc123XYZ?x=1' } });
    submit();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/klub/abc123XYZ');
    expect(screen.queryByText(/Tomuhle odkazu nerozumíme/)).toBeNull();
  });

  it('opens the registration of a bare token', () => {
    const { navigate, input, submit } = setup();
    fireEvent.change(input, { target: { value: '  Zk4-9pQ_tok  ' } });
    submit();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/klub/Zk4-9pQ_tok');
  });

  it('submits with Enter, too (it is a form)', () => {
    const { navigate, input } = setup();
    fireEvent.change(input, { target: { value: 'abc123XYZ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(navigate).toHaveBeenCalledWith('/klub/abc123XYZ');
  });

  it('says what is wrong, navigates nowhere, and clears the message as soon as the athlete types again', () => {
    const { navigate, input, submit } = setup();
    submit();
    expect(screen.getByText(/Tomuhle odkazu nerozumíme/)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('club-link-error');

    fireEvent.change(input, { target: { value: 'to není odkaz' } });
    expect(screen.queryByText(/Tomuhle odkazu nerozumíme/)).toBeNull();
    submit();
    expect(screen.getByText(/Tomuhle odkazu nerozumíme/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('prerendering (renderToString, no browser, no API)', () => {
  it.each(['/dokumenty', '/kontakt', '/o-nas', '/kluby'])('%s renders with one H1 and no amount', (path) => {
    const result = renderToHtml(path, EMPTY_BOOTSTRAP);
    expect(result.found).toBe(true);
    expect(result.html.match(/<h1[\s>]/g)).toHaveLength(1);
    // Only the words on the page: the stylesheet is full of "100%".
    const text = result.html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
    expect(text).not.toMatch(/\d(?:&nbsp;|\s| )*(?:Kč|%|&#x25;)/);
    expect(result.html).not.toContain('<iframe');
  });

  it('Pro kluby has the anchor "mam-odkaz" and the input in the HTML', () => {
    const { html } = renderToHtml('/kluby', EMPTY_BOOTSTRAP);
    expect(html).toContain('id="mam-odkaz"');
    expect(html).toContain('id="club-link-input"');
  });

  it("Kontakt puts the clinic's build-time details into the HTML", () => {
    const data = normalizeBootstrap({ clinic: { name: 'K', phone: '+420 111 222 333', email: 'a@b.example', address: 'Nová 5', openingHours: 'Po–Pá 9:00–17:00' } }, 1);
    const { html } = renderToHtml('/kontakt', data);
    expect(html).toContain('href="tel:+420111222333"');
    expect(html).toContain('mailto:a@b.example');
    expect(html).toContain('9:00–17:00');
    expect(html).toContain('https://mapy.cz/zakladni?q=');
  });
});

describe('the slot registry of the four pages', () => {
  const prefixes = ['dokumenty.', 'kontakt.', 'onas.', 'kluby.'];
  const mine = SLOT_REGISTRY.filter((slot) => prefixes.some((prefix) => slot.key.startsWith(prefix)));

  it('is not empty, unique, valid and namespaced by its page', () => {
    expect(mine.length).toBeGreaterThan(100);
    expect(new Set(SLOT_REGISTRY.map((slot) => slot.key)).size).toBe(SLOT_REGISTRY.length);
    for (const slot of mine) {
      expect(slot.key, slot.key).toMatch(SLOT_KEY_PATTERN);
      expect(slot.label.trim(), slot.key).not.toBe('');
      expect(slot.group.trim(), slot.key).not.toBe('');
    }
  });

  it('gives a text slot a default and a media slot a caption, a recommended size and an aspect ratio', () => {
    for (const slot of mine) {
      if (slot.kind === 'text') {
        // (An address that is still to be published defaults to a dash, never to an empty text.)
        expect(slot.defaultText?.trim(), slot.key).toBeTruthy();
      } else {
        expect(slot.caption, slot.key).toBeTruthy();
        expect(slot.recommended, slot.key).toMatch(/\d+ × \d+ px/);
        expect(slot.aspect, slot.key).toMatch(/^\d+ \/ \d+$/);
      }
    }
  });

  it('hard-codes no price and no percentage in any default text', () => {
    for (const slot of mine) expect(slot.defaultText ?? '', slot.key).not.toMatch(/\d\s*%|Kč/);
  });

  it('covers every slot the four pages ask for', () => {
    for (const element of [<DokumentyPage key="d" />, <KontaktPage key="k" />, <ONasPage key="o" />, <KlubyPage key="c" />]) {
      renderWeb(element);
      cleanup();
    }
    expect(askedKeys.size).toBeGreaterThan(80);
    const unknown = [...askedKeys].filter((key) => slotDef(key) === undefined);
    expect(unknown).toEqual([]);
  });
});
