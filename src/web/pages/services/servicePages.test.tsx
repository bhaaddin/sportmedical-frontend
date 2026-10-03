import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { VIEWPORTS } from '../../../test/viewport';
import { SLOT_KEY_PATTERN, SLOT_REGISTRY, SLOTS_BY_PAGE, slotDef } from '../../../site/siteSlots';
import { render } from '../../entry-server';
import { EMPTY_BOOTSTRAP, normalizeBootstrap } from '../../data';
import { WEB_ROUTES } from '../../routes';
import { renderWeb } from '../../testUtils';
import { tierRange } from './blocks';
import { categorySlug, findCombo, findItem } from './pricing';
import SluzbyPage from '../SluzbyPage';
import ProhlidkyPage from '../ProhlidkyPage';
import DiagnostikaPage from '../DiagnostikaPage';
import InBodyPage from '../InBodyPage';
import CenikPage from '../CenikPage';
import VybaveniPage from '../VybaveniPage';
import DiagZakladniPage from '../DiagZakladniPage';
import DiagKomplexniPage from '../DiagKomplexniPage';
import DiagVo2maxPage from '../DiagVo2maxPage';
import DiagKompenzacniPage from '../DiagKompenzacniPage';

const get = vi.fn();
vi.mock('../../http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../http')>();
  return { ...actual, webHttp: { get: (...args: unknown[]) => get(...args) } };
});

beforeEach(() => { get.mockReset(); });
afterEach(cleanup);

/** Obviously made-up amounts: the tests prove a price comes from the list, not that it is right. */
const PRICES = [
  {
    category: 'Sportovní lékařské prohlídky',
    items: [
      { code: 'p1', name: 'Základní sportovní prohlídka', description: 'Anamnéza a EKG', priceCzk: 1111, durationMinutes: 35 },
      { code: 'p2', name: 'Komplexní sportovní prohlídka', description: '', priceCzk: 2222, durationMinutes: 55 },
      { code: 'p3', name: 'Spiroergometrické vyšetření', description: '', priceCzk: 3333, durationMinutes: 75 },
      { code: 'p9', name: 'Nová testovací služba prohlídek', description: '', priceCzk: 1010, durationMinutes: 20 },
    ],
  },
  {
    category: 'Sportovní diagnostika',
    items: [
      { code: 'd1', name: 'Základní diagnostika', description: '', priceCzk: 5555, durationMinutes: 60 },
      { code: 'd0', name: 'Komplexní diagnostika', description: '', priceCzk: 5656, durationMinutes: 90 },
      { code: 'd2', name: 'Komplexní diagnostika + VO₂max analýza', description: '', priceCzk: 6666, listPriceCzk: 6969, durationMinutes: 120 },
      { code: 'd3', name: 'VO₂max analýza', description: '', priceCzk: 7777, durationMinutes: 60 },
      { code: 'd4', name: 'Individuální videoinstruovaný kompenzační plán', description: '', priceCzk: 8888, durationMinutes: null },
      { code: 'd9', name: 'Nová testovací diagnostika', description: '', priceCzk: 1212, durationMinutes: 20 },
    ],
  },
  {
    category: 'InBody 770 – tělesná analýza',
    items: [
      { code: 'i1', name: 'Základní InBody měření', description: '', priceCzk: 987, durationMinutes: 15 },
      { code: 'i2', name: 'InBody komplexní měření + odborná konzultace', description: '', priceCzk: 1987, durationMinutes: 45 },
      { code: 'i3', name: 'Sestavení personalizovaného výživového plánu', description: '', priceCzk: 2987, durationMinutes: 60 },
      { code: 'i4', name: 'Zvýhodněný balíček 5 měření InBody (základní)', description: '', priceCzk: 4321, listPriceCzk: 4999, durationMinutes: null },
      { code: 'i9', name: 'Nové testovací měření', description: '', priceCzk: 1313, durationMinutes: 10 },
    ],
  },
  {
    category: 'Zvýhodněné balíčky – prohlídka + diagnostika',
    items: [
      { code: 'z1', name: 'Komplexní prohlídka + Základní diagnostika', description: '', priceCzk: 9101, listPriceCzk: 9999, durationMinutes: 120 },
      { code: 'z2', name: 'Komplexní prohlídka + Komplexní diagnostika', description: '', priceCzk: 9102, durationMinutes: 150 },
      { code: 'z3', name: 'Spiroergometrie + Základní diagnostika', description: '', priceCzk: 9103, durationMinutes: 150 },
      { code: 'z4', name: 'Spiroergometrie + Komplexní diagnostika', description: '', priceCzk: 9104, durationMinutes: 180 },
    ],
  },
];

const TIERS = [{ minPersons: 4, percent: 5 }, { minPersons: 6, percent: 10 }, { minPersons: 10, percent: 15 }];

const serverDown = () => get.mockRejectedValue(new Error('Network Error'));
function serverUp(tiers?: unknown) {
  get.mockImplementation((url: string) => {
    if (url === '/api/public/price-list') return Promise.resolve({ data: PRICES });
    if (url === '/api/public/discount-tiers' && tiers !== undefined) return Promise.resolve({ data: tiers });
    return Promise.reject(new Error(`404 ${url}`));
  });
}

interface PageCase {
  name: string;
  path: string;
  Page: ComponentType;
  h1: RegExp;
  /** H2 headings the page must have, at every width. */
  h2: RegExp[];
  /** A caption of a photo placeholder that proves the media slots are there. */
  caption: string;
  /** The registry key prefix(es) of the page: every key under it must be drawn by the page. */
  prefixes: string[];
  /** Does the page show amounts at all? (The equipment page does not.) */
  hasPrices?: boolean;
}

const PAGES: PageCase[] = [
  {
    name: 'Služby', path: '/sluzby', Page: SluzbyPage, prefixes: ['sluzby.'],
    h1: /^Služby$/, h2: [/Sportovní lékařské prohlídky, sportovní diagnostika, InBody 770/, /Jednorázová vyšetření/, /Zvýhodněné balíčky/, /Nejmodernější diagnostické vybavení/],
    caption: '[FOTO: tým v ordinaci]',
  },
  {
    name: 'Prohlídky', path: '/prohlidky', Page: ProhlidkyPage, prefixes: ['prohlidky.'],
    h1: /^Sportovní lékařské prohlídky$/,
    h2: [/Komplexní vyšetření zaměřené na reakci těla/, /Nevíte, jaký typ vyšetření zvolit/, /Potřebné dokumenty/, /Příprava na zátěžový test/, /Zvýhodněné balíčky/, /Ceník služeb – sportovní lékařské prohlídky/],
    caption: '[FOTO: prohlídka u lékaře]',
  },
  {
    name: 'Diagnostika', path: '/diagnostika', Page: DiagnostikaPage, prefixes: ['diagnostika.'],
    h1: /^Sportovní diagnostika$/,
    h2: [/Naše služby/, /Nepracujeme s pocitem/, /Sestavení individuálních balíčků na míru/, /Vysoce citlivá analýza/, /Od vizualizace ke změně/, /Ceník služeb – sportovní diagnostika/, /Rezervační systém/],
    caption: '[FOTO: ForceDecks měření]',
  },
  {
    name: 'InBody', path: '/inbody', Page: InBodyPage, prefixes: ['inbody.'],
    h1: /^InBody 770$/,
    h2: [/Co InBody 770 měří/, /To nejlepší z tělesné analýzy/, /Diagnostická přesnost/, /Komplexní parametry/, /Ceník služeb – tělesná analýza InBody 770/, /Jak se správně připravit/],
    caption: '[FOTO: přístroj InBody 770]',
  },
  {
    name: 'Ceník', path: '/cenik', Page: CenikPage, prefixes: ['cenik.'],
    h1: /^Ceník služeb$/, h2: [/Sportovní lékařské prohlídky/, /Sportovní diagnostika/, /InBody 770/, /Další informace/], caption: '[FOTO: recepce kliniky]',
  },
  {
    name: 'Vybavení', path: '/vybaveni', Page: VybaveniPage, prefixes: ['vybaveni.'],
    h1: /^Vybavení$/, h2: [/Nejmodernější diagnostické vybavení/, /Naše technologie/], caption: '[FOTO: diagnostické pracoviště]', hasPrices: false,
  },
  {
    name: 'Základní diagnostika', path: '/diagnostika/zakladni', Page: DiagZakladniPage, prefixes: ['diagzakladni.'],
    h1: /^Základní diagnostika$/, h2: [/O vyšetření/, /Obsah Základní diagnostiky/, /Co můžete očekávat/, /Cena a objednání/], caption: '[FOTO: vysoce citlivé silové platformy]',
  },
  {
    name: 'Komplexní diagnostika', path: '/diagnostika/komplexni', Page: DiagKomplexniPage, prefixes: ['diagkomplexni.'],
    h1: /^Komplexní diagnostika$/, h2: [/Klíčové vlastnosti/, /Dva neoddělitelné pilíře/, /Interpretace výsledků/, /Obsah Komplexní diagnostiky/, /Cena a objednání/],
    caption: '[FOTO: komplexní diagnostika s videoanalýzou]',
  },
  {
    name: 'Vo2max', path: '/diagnostika/vo2max', Page: DiagVo2maxPage, prefixes: ['diagvo2max.'],
    h1: /^Vo2max analýza$/, h2: [/Co vyšetření nabízí/, /Vidíme to, co oko nepostřehne/, /Klíčové funkce Cortex 21/, /Cena a objednání/], caption: '[FOTO: spiroergometrie Cortex 21]',
  },
  {
    name: 'Kompenzační plán', path: '/diagnostika/kompenzacni-plan', Page: DiagKompenzacniPage, prefixes: ['diagkompenzacni.'],
    h1: /Sestavení individuálního kompenzačního plánu/, h2: [/Od přesné diagnostiky k cílené nápravě/, /Jedna aplikace/, /Cena a objednání/], caption: '[FOTO: kompenzační plán s video-instruktáží]',
  },
];

const widths = [
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const;

const squash = (text: string) => text.replace(/\s+/g, '');
const plain = (text: string | null) => (text ?? '').replace(/ /g, ' ');

describe.each(PAGES)('$name — page', ({ path, Page, h1, h2, caption, hasPrices = true }) => {
  describe.each(widths)('at %s (%i px)', (_name, width) => {
    it('renders its one H1, its sections, the hero photo slot and the booking link', () => {
      serverDown();
      renderWeb(<Page />, { width, route: path });
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(h1);
      for (const heading of h2) expect(screen.getAllByRole('heading', { level: 2, name: heading }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(caption)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /Objednat termín/ })[0]).toHaveAttribute('href', '/objednat');
    });

    it('shows no amount while the price list is unknown — "—", never a remembered number', async () => {
      serverDown();
      const { container } = renderWeb(<Page />, { width, route: path });
      await waitFor(() => { expect(get).toHaveBeenCalled(); });
      expect(container.textContent).not.toMatch(/\d\s*Kč/);
      expect(container.textContent).not.toMatch(/\d\s*%/);
      if (hasPrices) expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('puts the heading levels in order: one H1, then H2 sections, H3 only inside them', () => {
    serverDown();
    const { container } = renderWeb(<Page />, { route: path });
    const levels = [...container.querySelectorAll('h1, h2, h3, h4')].map((el) => Number(el.tagName[1]));
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level - levels[index - 1]).toBeLessThanOrEqual(1);
    });
  });

  it('renders to a string without throwing, with no API and with a build-time snapshot (prerender)', () => {
    const route = WEB_ROUTES.find((entry) => entry.path === path);
    expect(route).toBeDefined();
    const empty = render(path, EMPTY_BOOTSTRAP);
    expect(empty.found).toBe(true);
    expect(empty.html.match(/<h1[\s>]/g)).toHaveLength(1);
    // No amount and no percentage in the HTML unless the price list / the discount tiers supplied it.
    expect(empty.html).not.toMatch(/\d(?:&nbsp;|\s| )*Kč/);
    expect(empty.html.replace(/<[^>]+>/g, ' ')).not.toMatch(/\d\s*%/);
    const seeded = render(path, normalizeBootstrap({ priceList: PRICES, discountTiers: TIERS }, 1));
    expect(seeded.html.match(/<h1[\s>]/g)).toHaveLength(1);
  });
});

describe('every slot of a page is drawn by that page (and the other way round)', () => {
  /** Keys that appear only after a failed load (their own test: "Zkusit znovu"). */
  const ONLY_ON_ERROR = new Set(['cenik.error.text', 'cenik.error.retry']);
  /** Keys that are an accessible name, not visible text (checked in their own test). */
  const ARIA_ONLY = new Set(['prohlidky.cmp.caption']);

  it.each(PAGES)('$name draws every registry key under its prefix', async ({ Page, path, prefixes, hasPrices = true }) => {
    serverUp(TIERS);
    const { container } = renderWeb(<Page />, { route: path });
    if (hasPrices) {
      await waitFor(() => { expect(container.textContent).toMatch(/\d\s?Kč/); });
      await waitFor(() => { expect(container.textContent).toContain('−5'); });
    }
    const text = squash(container.textContent ?? '');
    const missing: string[] = [];
    for (const slot of SLOT_REGISTRY) {
      if (!prefixes.some((prefix) => slot.key.startsWith(prefix))) continue;
      if (slot.key.startsWith('sluzby.shared.')) continue;
      if (ONLY_ON_ERROR.has(slot.key) || ARIA_ONLY.has(slot.key)) continue;
      if (slot.kind === 'text') {
        if (!text.includes(squash(slot.defaultText ?? ''))) missing.push(slot.key);
      } else if (container.querySelector(`[data-slot="${slot.key}"]`) === null) missing.push(slot.key);
    }
    expect(missing).toEqual([]);
  });

  it('the shared texts of the service pages are drawn by at least one of the pages', async () => {
    serverUp(TIERS);
    let drawn = '';
    const media = new Set<string>();
    for (const { Page, path, hasPrices = true } of PAGES) {
      const { container, unmount } = renderWeb(<Page />, { route: path });
      if (hasPrices) {
        await waitFor(() => { expect(container.textContent).toMatch(/\d\s?Kč/); });
        await waitFor(() => { expect(container.textContent).toContain('−5'); });
      }
      drawn += squash(container.textContent ?? '');
      container.querySelectorAll('[data-slot]').forEach((el) => media.add(el.getAttribute('data-slot') ?? ''));
      unmount();
    }
    const missing = SLOT_REGISTRY
      .filter((slot) => slot.key.startsWith('sluzby.shared.'))
      .filter((slot) => (slot.kind === 'text' ? !drawn.includes(squash(slot.defaultText ?? '')) : !media.has(slot.key)))
      .map((slot) => slot.key);
    expect(missing).toEqual([]);
  });

  it('every slot a page draws is registered', () => {
    serverDown();
    for (const { Page, path } of PAGES) {
      const { container, unmount } = renderWeb(<Page />, { route: path });
      container.querySelectorAll('[data-slot]').forEach((el) => {
        expect(slotDef(el.getAttribute('data-slot') ?? ''), el.getAttribute('data-slot') ?? '').toBeDefined();
      });
      unmount();
    }
  });
});

describe('the prices of the services pages come from the price list', () => {
  it('Prohlídky: each examination carries its own price; the "+" packages are cards with their own price and crossed-out list price', async () => {
    serverUp();
    const { container } = renderWeb(<ProhlidkyPage />);
    expect((await screen.findAllByText(/^1\s111\sKč$/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^2\s222\sKč$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^3\s333\sKč$/).length).toBeGreaterThanOrEqual(1);
    // The package "Komplexní prohlídka + Základní diagnostika": price and the crossed-out price before the discount.
    expect(screen.getByText(/^9\s101\sKč$/)).toBeInTheDocument();
    const struck = container.querySelectorAll('s');
    expect([...struck].map((el) => plain(el.textContent))).toContain('9 999 Kč');
    // The other items of the category the page does not show elsewhere are listed as "Další varianty".
    expect(screen.getByRole('heading', { level: 3, name: 'Další varianty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nová testovací služba prohlídek.*1\s010\sKč/ })).toHaveAttribute('href', '/objednat');
    // The comparison table has the price row from the list.
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    expect(within(table).getByText(/^1\s111\sKč$/)).toBeInTheDocument();
  });

  it('Prohlídky: the comparison table is a labelled, scrollable region', () => {
    serverDown();
    renderWeb(<ProhlidkyPage />);
    const region = screen.getByRole('region', { name: 'Porovnání sportovních lékařských prohlídek' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });

  it('Prohlídky: the comparison table keeps the live rows, "Ano" / "Ne" and the cell texts', () => {
    serverDown();
    renderWeb(<ProhlidkyPage />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Délka vyšetření' })).toBeInTheDocument();
    expect(within(table).getAllByText('Ano').length).toBeGreaterThanOrEqual(10);
    expect(within(table).getAllByText('Ne').length).toBeGreaterThanOrEqual(5);
    expect(within(table).getByText('kolo / běžecký pás')).toBeInTheDocument();
    expect(within(table).getByText('30–40 min')).toBeInTheDocument();
  });

  it('Diagnostika: the cards carry the price of their service, the packages theirs, with the crossed-out list price', async () => {
    serverUp();
    const { container } = renderWeb(<DiagnostikaPage />);
    expect((await screen.findAllByText(/^7\s777\sKč$/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^8\s888\sKč$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^6\s666\sKč$/)).toBeInTheDocument();
    expect([...container.querySelectorAll('s')].map((el) => plain(el.textContent))).toContain('6 969 Kč');
    for (const id of ['9 101', '9 102', '9 103', '9 104']) expect(screen.getByText(new RegExp(`^${id.replace(' ', '\\s')}\\sKč$`))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nová testovací diagnostika.*1\s212\sKč/ })).toBeInTheDocument();
    // The expandable lines are real <details> with their text in the HTML.
    expect(container.querySelectorAll('details').length).toBeGreaterThan(20);
  });

  it('InBody: the four cards carry the price of their item (ordered online or by the clinic\'s phone)', async () => {
    serverUp();
    renderWeb(<InBodyPage />);
    expect((await screen.findAllByText(/^987\sKč$/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^1\s987\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^2\s987\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^4\s321\sKč$/)).toBeInTheDocument();
    expect(screen.getAllByText('Objednání telefonicky nebo zprávou')).toHaveLength(4);
  });

  it('Služby: each service card lists the first rows of its category and links to its detail page', async () => {
    serverUp();
    renderWeb(<SluzbyPage />);
    expect((await screen.findAllByText(/^1\s111\sKč$/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { level: 3, name: 'Sportovní lékařské prohlídky' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Základní sportovní prohlídka/ })).toHaveAttribute('href', '/prohlidky');
    expect(screen.getByRole('link', { name: /^Základní diagnostika/ })).toHaveAttribute('href', '/diagnostika');
    expect(screen.getByRole('link', { name: /Základní InBody měření/ })).toHaveAttribute('href', '/inbody');
    expect(screen.getByRole('link', { name: /Spiroergometrie \+ Komplexní diagnostika.*9\s104\sKč/ })).toBeInTheDocument();
  });

  it.each([
    [DiagZakladniPage, /^5\s555\sKč$/],
    [DiagKomplexniPage, /^5\s656\sKč$/],
    [DiagVo2maxPage, /^7\s777\sKč$/],
    [DiagKompenzacniPage, /^8\s888\sKč$/],
  ])('a diagnostics detail page shows the price of its own service from the list', async (Page, price) => {
    serverUp();
    renderWeb(<Page />);
    expect((await screen.findAllByText(price)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: 'Objednat termín' }).length).toBeGreaterThanOrEqual(1);
  });

  it('matches items by name, not by amount, and never takes a "+" package for a single service', () => {
    expect(findItem(PRICES, /^zakladni sportovni prohlidka/)?.code).toBe('p1');
    expect(findItem(PRICES, /^vo2max/)?.code).toBe('d3');
    expect(findItem(PRICES, /^komplexni diagnostika/)?.code).toBe('d0');
    const noSingle = [{ category: 'x', items: [PRICES[1].items[2]] }];
    expect(findItem(noSingle, /^komplexni diagnostika/)).toBeNull();
  });

  it('finds a package by the two services it joins, whichever order the admin wrote them in', () => {
    const rows = [{ category: 'x', items: [{ code: 'q', name: 'Základní diagnostika + Komplexní sportovní prohlídka', description: '', priceCzk: 1, durationMinutes: null }] }];
    expect(findCombo(rows, /^komplexni (sportovni )?prohlidka/, /^zakladni diagnostika/)?.code).toBe('q');
    expect(findCombo(rows, /^komplexni diagnostika/, /^komplexni (sportovni )?prohlidka/)).toBeNull();
  });
});

describe('Ceník — the whole list, live', () => {
  it.each(widths)('lists every category and row of the API at %s (%i px), in the API order', async (_name, width) => {
    serverUp();
    const { container } = renderWeb(<CenikPage />, { width });
    await screen.findByText(/^1\s111\sKč$/);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
    expect(headings.slice(0, 4)).toEqual([
      'Sportovní lékařské prohlídky', 'Sportovní diagnostika', 'InBody 770 – tělesná analýza', 'Zvýhodněné balíčky – prohlídka + diagnostika',
    ]);
    // 4 + 6 + 5 + 4 rows of the mock, all as links to the booking.
    const rows = container.querySelectorAll('[role="listitem"] > a');
    expect(rows).toHaveLength(19);
    rows.forEach((row) => expect(row).toHaveAttribute('href', '/objednat'));
    expect(screen.getByText(/^9\s104\sKč$/)).toBeInTheDocument();
    // The list price is crossed out, never the word "běžně".
    expect([...container.querySelectorAll('s')].map((el) => plain(el.textContent))).toEqual(['6 969 Kč', '4 999 Kč', '9 999 Kč']);
    expect(container.textContent).not.toMatch(/běžně/i);
    // Durations sit next to the names, the row's description under the name.
    expect(screen.getAllByText(/^35\smin$/)).toHaveLength(1);
    expect(screen.getByText('Anamnéza a EKG')).toBeInTheDocument();
  });

  it('has an anchor chip for every category and for the clubs, each pointing at an element that exists', async () => {
    serverUp();
    const { container } = renderWeb(<CenikPage />);
    await screen.findByText(/^1\s111\sKč$/);
    const nav = screen.getByRole('navigation', { name: 'Kategorie ceníku' });
    const chips = within(nav).getAllByRole('link');
    expect(chips).toHaveLength(5);
    expect(chips[0]).toHaveAttribute('href', `#${categorySlug('Sportovní lékařské prohlídky')}`);
    chips.forEach((chip) => {
      const id = (chip.getAttribute('href') ?? '').slice(1);
      expect(container.querySelector(`[id="${id}"]`), id).not.toBeNull();
    });
  });

  it('shows the three service names with dashes while the API has said nothing, and a "Zkusit znovu" that retries', async () => {
    serverDown();
    renderWeb(<CenikPage />);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
    expect(headings.slice(0, 3)).toEqual(['Sportovní lékařské prohlídky', 'Sportovní diagnostika', 'InBody 770 – tělesná analýza']);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ceník se teď nepodařilo načíst');
    const calls = get.mock.calls.length;
    serverUp();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText(/^1\s111\sKč$/)).toBeInTheDocument();
    expect(get.mock.calls.length).toBeGreaterThan(calls);
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull(); });
  });

  it('carries the notes of the live price list (payment, documents, validity, the package note) as slots', () => {
    serverDown();
    renderWeb(<CenikPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Další informace' })).toBeInTheDocument();
    expect(screen.getByText(/Služby mohou být hrazeny předem online/)).toBeInTheDocument();
    expect(screen.getByText('Souhlas zákonného zástupce')).toBeInTheDocument();
    expect(screen.getByText('Celková délka balíčku: přibližně 60 minut')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dokumenty ke stažení' })).toHaveAttribute('href', '/dokumenty');
    expect(screen.queryByText(/hotově nebo kartou/)).toBeNull();
  });
});

describe('the group-discount block', () => {
  it.each(PAGES.filter((page) => page.name !== 'Ceník' && page.name !== 'Vybavení'))('is hidden on $name when the server publishes no tiers', async ({ Page, path }) => {
    serverUp();
    const { container } = renderWeb(<Page />, { route: path });
    await screen.findAllByText(/\d\sKč$/);
    expect(screen.queryByText('Čím větší skupina, tím výhodnější podmínky')).toBeNull();
    expect(container.textContent).not.toMatch(/−\s*\d+(?:,\d+)?\s*%/);
  });

  it.each(PAGES.filter((page) => page.name !== 'Vybavení'))('shows the server\'s tiers on $name, with the range of each', async ({ Page, path }) => {
    serverUp(TIERS);
    renderWeb(<Page />, { route: path });
    expect(await screen.findByText(/^−5\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^−10\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^−15\s%$/)).toBeInTheDocument();
    expect(screen.getByText('4–5 osob')).toBeInTheDocument();
    expect(screen.getByText('6–9 osob')).toBeInTheDocument();
    expect(screen.getByText('10 a více osob')).toBeInTheDocument();
    expect(screen.getAllByText('/ osoba')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Sportovní kluby\/organizace/ })).toHaveAttribute('href', '/kluby');
  });

  it('on the price list the club card stays even without tiers (the "Kluby" chip points at it)', () => {
    serverDown();
    const { container } = renderWeb(<CenikPage />);
    expect(container.querySelector('#kluby-a-skupiny')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Sportovní kluby\/organizace/ })).toBeInTheDocument();
  });

  it('computes a tier\'s range from the next tier', () => {
    expect(tierRange(TIERS, 0)).toBe('4–5 osob');
    expect(tierRange(TIERS, 2)).toBe('10 a více osob');
    expect(tierRange([{ minPersons: 4, percent: 5 }, { minPersons: 5, percent: 8 }], 0)).toBe('4 osob');
  });
});

describe('Vybavení — the devices of the live site', () => {
  it('lists the five devices of the examinations page and the three of the diagnostics, each with a photo slot', () => {
    serverDown();
    const { container } = renderWeb(<VybaveniPage />);
    const names = screen.getAllByRole('heading', { level: 3 }).map((el) => el.textContent);
    expect(names).toEqual([
      '1. Antropometrie', '2. Podtlakové EKG', '3. Lode Excalibur Sport', '4. Základní funkční vyšetření plic', '5. Spiroergometrie', 'HumanTrak', 'ForceDecks', 'Cortex 21',
    ]);
    expect(container.querySelectorAll('[data-slot$=".photo"]').length).toBeGreaterThanOrEqual(9);
    expect(screen.getByText(/10 W až do 3000 W/)).toBeInTheDocument();
    expect(screen.getByText(/ultrazvukové technologii PureFlow/)).toBeInTheDocument();
  });
});

describe('what the live site marks as stale or wrong is not on our pages', () => {
  const STALE = [
    /Pod Krejcárkem/i, /barnamedical/i, /sportlab/i, /seznam\.cz/i, /792\s?314\s?456/, /fdcgvvp/i, /Již brzy dostupné/i, /9[.:]00\s*[–-]\s*16[.:]00/, /Naša predajňa/i,
  ];

  it('keeps stale contact data, the datová schránka, the stale hours and "Již brzy dostupné" out of the defaults and of the HTML', () => {
    const own = (['sluzby', 'prohlidky', 'diagnostika', 'inbody', 'cenik', 'vybaveni', 'diagzakladni', 'diagkomplexni', 'diagvo2max', 'diagkompenzacni'] as const)
      .flatMap((page) => SLOTS_BY_PAGE[page]);
    for (const slot of own) for (const pattern of STALE) expect(`${slot.defaultText ?? ''} ${slot.caption ?? ''}`, slot.key).not.toMatch(pattern);
    for (const { path } of PAGES) {
      const { html } = render(path, EMPTY_BOOTSTRAP);
      for (const pattern of STALE) expect(html, path).not.toMatch(pattern);
    }
  });

  it('does not type a phone number, an e-mail or an address in the page code (contact data comes from the clinic settings)', () => {
    const sources = import.meta.glob(['../*.tsx', './*.tsx', './content/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const own = Object.entries(sources).filter(([file]) => !file.includes('.test.') && (file.startsWith('./') || /(Sluzby|Prohlidky|Diagnostika|InBody|Cenik|Vybaveni|Diag\w+)Page\.tsx$/.test(file)));
    expect(own.length).toBeGreaterThan(10);
    for (const [file, code] of own) {
      expect(code, file).not.toMatch(/\+?420\s?\d{3}|\b606\s?785|@sportmedical|Jihlavsk|Michle/);
    }
  });

  it('links go through SiteLink (CtaButton / ArrowLink): no plain internal href in the page code', () => {
    const sources = import.meta.glob(['../*.tsx', './*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [file, code] of Object.entries(sources)) {
      if (file.includes('.test.')) continue;
      if (!/(Sluzby|Prohlidky|Diagnostika|InBody|Cenik|Vybaveni|Diag\w+)Page\.tsx$/.test(file) && !file.startsWith('./')) continue;
      expect(code, file).not.toMatch(/href=\{?["'`]\/(?!\/)/);
    }
  });
});

describe('the slot registries of the pages', () => {
  const keys = (['sluzby', 'prohlidky', 'diagnostika', 'inbody', 'cenik', 'vybaveni', 'diagzakladni', 'diagkomplexni', 'diagvo2max', 'diagkompenzacni'] as const).flatMap((page) => SLOTS_BY_PAGE[page]);

  it('are filled, with valid and unique keys that the shared registry finds', () => {
    expect(keys.length).toBeGreaterThan(600);
    const seen = new Set<string>();
    for (const slot of keys) {
      expect(slot.key, slot.key).toMatch(SLOT_KEY_PATTERN);
      expect(seen.has(slot.key), `duplicate ${slot.key}`).toBe(false);
      seen.add(slot.key);
      expect(slotDef(slot.key)).toBe(slot);
      expect(slot.label.trim(), slot.key).not.toBe('');
      expect(slot.group.trim(), slot.key).not.toBe('');
      expect(slot.group, slot.key).toContain('›');
    }
  });

  it('give every text a default and every media slot a caption, a size and an aspect ratio', () => {
    for (const slot of keys) {
      if (slot.kind === 'text') expect((slot.defaultText ?? '').trim(), slot.key).not.toBe('');
      else {
        expect((slot.caption ?? '').trim(), slot.key).not.toBe('');
        expect(slot.recommended, slot.key).toMatch(/^\d+ × \d+ px$/);
        expect(slot.aspect, slot.key).toMatch(/^\d+ \/ \d+$/);
      }
    }
  });

  it('keep every amount out of the defaults: a number followed by Kč, or a percentage, is never a default text', () => {
    for (const slot of keys) {
      expect(slot.defaultText ?? '', slot.key).not.toMatch(/\d\s*Kč/);
      expect(slot.defaultText ?? '', slot.key).not.toMatch(/\d\s*%/);
      expect(slot.defaultText ?? '', slot.key).not.toMatch(/běžně/i);
    }
  });
});
