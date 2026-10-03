import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { VIEWPORTS } from '../../../test/viewport';
import { SLOT_KEY_PATTERN, SLOTS_BY_PAGE, slotDef } from '../../../site/siteSlots';
import { render } from '../../entry-server';
import { EMPTY_BOOTSTRAP, normalizeBootstrap } from '../../data';
import { WEB_ROUTES } from '../../routes';
import { renderWeb } from '../../testUtils';
import { tierRange } from './blocks';
import { categorySlug, findItem } from './pricing';
import SluzbyPage from '../SluzbyPage';
import ProhlidkyPage from '../ProhlidkyPage';
import DiagnostikaPage from '../DiagnostikaPage';
import InBodyPage from '../InBodyPage';
import CenikPage from '../CenikPage';

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
      { code: 'p1', name: 'Základní sportovní prohlídka', description: '', priceCzk: 1111, durationMinutes: 35 },
      { code: 'p2', name: 'Komplexní sportovní prohlídka', description: '', priceCzk: 2222, durationMinutes: 55 },
      { code: 'p3', name: 'Spiroergometrické vyšetření', description: '', priceCzk: 3333, durationMinutes: 75 },
      { code: 'p4', name: 'Komplexní sportovní prohlídka + Základní diagnostika', description: '', priceCzk: 4444, durationMinutes: 90 },
    ],
  },
  {
    category: 'Sportovní diagnostika',
    items: [
      { code: 'd1', name: 'Základní diagnostika', description: '', priceCzk: 5555, durationMinutes: 60 },
      { code: 'd2', name: 'Komplexní diagnostika + Vo2max analýza', description: '', priceCzk: 6666, durationMinutes: 120 },
      { code: 'd3', name: 'Vo2max', description: '', priceCzk: 7777, durationMinutes: 60 },
      { code: 'd4', name: 'Sestavení individuálního videoinstruovaného kompenzačního plánu', description: '', priceCzk: 8888, durationMinutes: null },
    ],
  },
  {
    category: 'InBody 770 – tělesná analýza',
    items: [
      { code: 'i1', name: 'Základní InBody měření', description: '', priceCzk: 987, durationMinutes: 15 },
      { code: 'i2', name: 'Zvýhodněný balíček 5 měření (základní)', description: '', priceCzk: 4321, durationMinutes: null },
    ],
  },
  {
    category: 'Zvýhodněné balíčky – prohlídka + diagnostika',
    items: [{ code: 'z1', name: 'Kompletní diagnostika + Komplexní sportovní prohlídka', description: '', priceCzk: 9999, durationMinutes: 150 }],
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
  slotPage: keyof typeof SLOTS_BY_PAGE;
}

const PAGES: PageCase[] = [
  {
    name: 'Služby', path: '/web/sluzby', Page: SluzbyPage, slotPage: 'sluzby',
    h1: /Tři okruhy, jedna klinika/, h2: [/Co u nás absolvujete/, /Na čem měříme/], caption: '[FOTO: tým v ordinaci]',
  },
  {
    name: 'Prohlídky', path: '/web/prohlidky', Page: ProhlidkyPage, slotPage: 'prohlidky',
    h1: /Potvrzení, že můžete naplno/, h2: [/Porovnání prohlídek/, /Důležité informace před vyšetřením/, /Jak vyšetření probíhá/], caption: '[FOTO: prohlídka u lékaře]',
  },
  {
    name: 'Diagnostika', path: '/web/diagnostika', Page: DiagnostikaPage, slotPage: 'diagnostika',
    h1: /Čísla, podle kterých se dá trénovat/, h2: [/Hlavní vyšetření/, /Balíčky/, /Co dostanete/], caption: '[FOTO: ForceDecks měření]',
  },
  {
    name: 'InBody', path: '/web/inbody', Page: InBodyPage, slotPage: 'inbody',
    h1: /Přesný obraz těla, ne jen váha/, h2: [/Co InBody 770 měří/, /Varianty měření/, /Proč balíček pěti měření/, /Příprava na měření/], caption: '[FOTO: přístroj InBody 770]',
  },
  {
    name: 'Ceník', path: '/web/cenik', Page: CenikPage, slotPage: 'cenik',
    h1: /Všechny ceny na jednom místě/, h2: [/Sportovní lékařské prohlídky/, /Sportovní diagnostika/, /InBody 770/], caption: '[FOTO: recepce kliniky]',
  },
];

const widths = [
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const;

describe.each(PAGES)('$name — /web page', ({ path, Page, h1, h2, caption }) => {
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
      expect(container.textContent).not.toMatch(/−\s*\d+(?:,\d+)?\s*%/);
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
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
    expect(empty.html).not.toMatch(/\d(?:&nbsp;|\s| )*Kč/);
    const seeded = render(path, normalizeBootstrap({ priceList: PRICES, discountTiers: TIERS }, 1));
    expect(seeded.html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(seeded.html).toMatch(/\d[\s ]Kč/);
  });
});

describe('the prices of the services pages come from the price list', () => {
  it('Prohlídky: each package card carries its own price; the "+" combinations are listed as other variants', async () => {
    serverUp();
    renderWeb(<ProhlidkyPage />);
    expect(await screen.findByText(/^1\s111\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^2\s222\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^3\s333\sKč$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Další varianty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Základní diagnostika.*4\s444\sKč/ })).toHaveAttribute('href', '/objednat');
    // The three cards each have the what / for / duration trio from the slots.
    expect(screen.getAllByText('Co je zahrnuto')).toHaveLength(3);
    expect(screen.getByText('30–40 minut')).toBeInTheDocument();
  });

  it('Diagnostika: VO₂max and the compensation plan have a price, the devices say "v balíčku"', async () => {
    serverUp();
    renderWeb(<DiagnostikaPage />);
    const vo2 = (await screen.findAllByText(/^7\s777\sKč$/))[0];
    expect(vo2).toBeInTheDocument();
    expect(screen.getAllByText(/^8\s888\sKč$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('v balíčku')).toHaveLength(2);
    // The combined packages come under the category's own name.
    expect(screen.getByRole('heading', { level: 3, name: 'Zvýhodněné balíčky – prohlídka + diagnostika' })).toBeInTheDocument();
    expect(screen.getByText(/^9\s999\sKč$/)).toBeInTheDocument();
  });

  it('InBody: the variants are the category rows', async () => {
    serverUp();
    renderWeb(<InBodyPage />);
    expect(await screen.findByText(/^987\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^4\s321\sKč$/)).toBeInTheDocument();
  });

  it('Služby: each service card lists the first rows of its category and links to its detail page', async () => {
    serverUp();
    renderWeb(<SluzbyPage />);
    expect(await screen.findByText(/^1\s111\sKč$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sportovní lékařské prohlídky' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Základní sportovní prohlídka/ })).toHaveAttribute('href', '/web/prohlidky');
    expect(screen.getByRole('link', { name: /^Základní diagnostika/ })).toHaveAttribute('href', '/web/diagnostika');
    expect(screen.getByRole('link', { name: /Základní InBody měření/ })).toHaveAttribute('href', '/web/inbody');
  });

  it('matches items by name, not by amount, and never takes a "+" package for a single service', () => {
    const baseline = findItem(PRICES, /^zakladni sportovni prohlidka/);
    expect(baseline?.code).toBe('p1');
    expect(findItem(PRICES, /^vo2max/)?.code).toBe('d3');
    expect(findItem(PRICES, /^komplexni diagnostika/)).toBeNull();
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
    // 4 + 4 + 2 + 1 rows of the mock, all as links to the booking.
    const rows = container.querySelectorAll('[role="listitem"] > a');
    expect(rows).toHaveLength(11);
    rows.forEach((row) => expect(row).toHaveAttribute('href', '/objednat'));
    expect(screen.getByText(/^9\s999\sKč$/)).toBeInTheDocument();
    // Durations sit next to the names, with a non-breaking space.
    expect(screen.getAllByText(/^35\smin$/)).toHaveLength(1);
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
    expect(screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent)).toEqual([
      'Sportovní lékařské prohlídky', 'Sportovní diagnostika', 'InBody 770 – tělesná analýza', 'Čím větší skupina, tím výhodnější podmínky',
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ceník se teď nepodařilo načíst');
    const calls = get.mock.calls.length;
    serverUp();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText(/^1\s111\sKč$/)).toBeInTheDocument();
    expect(get.mock.calls.length).toBeGreaterThan(calls);
    await waitFor(() => { expect(screen.queryByRole('alert')).toBeNull(); });
  });
});

describe('the group-discount block', () => {
  it.each(PAGES.filter((page) => page.name !== 'Ceník'))('is hidden on $name when the server publishes no tiers', async ({ Page, path }) => {
    serverUp();
    const { container } = renderWeb(<Page />, { route: path });
    await screen.findAllByText(/\d\sKč$/);
    expect(screen.queryByText('Čím větší skupina, tím výhodnější podmínky')).toBeNull();
    expect(container.textContent).not.toMatch(/−\s*\d+(?:,\d+)?\s*%/);
  });

  it.each(PAGES)('shows the server\'s tiers on $name, with the range of each', async ({ Page, path }) => {
    serverUp(TIERS);
    renderWeb(<Page />, { route: path });
    expect(await screen.findByText(/^−5\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^−10\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^−15\s%$/)).toBeInTheDocument();
    expect(screen.getByText('4–5 osob')).toBeInTheDocument();
    expect(screen.getByText('6–9 osob')).toBeInTheDocument();
    expect(screen.getByText('10 a více osob')).toBeInTheDocument();
    expect(screen.getAllByText('na osobu')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Kluby a organizace/ })).toHaveAttribute('href', '/web/kluby');
  });

  it('on the price list the club card stays even without tiers (the "Kluby" chip points at it)', () => {
    serverDown();
    const { container } = renderWeb(<CenikPage />);
    expect(container.querySelector('#kluby-a-skupiny')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Kluby a organizace/ })).toBeInTheDocument();
  });

  it('computes a tier\'s range from the next tier', () => {
    expect(tierRange(TIERS, 0)).toBe('4–5 osob');
    expect(tierRange(TIERS, 2)).toBe('10 a více osob');
    expect(tierRange([{ minPersons: 4, percent: 5 }, { minPersons: 5, percent: 8 }], 0)).toBe('4 osob');
  });
});

describe('the slot registries of the five pages', () => {
  const keys = (['sluzby', 'prohlidky', 'diagnostika', 'inbody', 'cenik'] as const).flatMap((page) => SLOTS_BY_PAGE[page]);

  it('are filled, with valid and unique keys that the shared registry finds', () => {
    expect(keys.length).toBeGreaterThan(100);
    const seen = new Set<string>();
    for (const slot of keys) {
      expect(slot.key, slot.key).toMatch(SLOT_KEY_PATTERN);
      expect(seen.has(slot.key), `duplicate ${slot.key}`).toBe(false);
      seen.add(slot.key);
      expect(slotDef(slot.key)).toBe(slot);
      expect(slot.label.trim(), slot.key).not.toBe('');
      expect(slot.group.trim(), slot.key).not.toBe('');
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
    }
  });

  it('cover every slot the pages draw: each rendered media slot and each text key is registered', () => {
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
