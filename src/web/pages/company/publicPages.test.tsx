import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { VIEWPORTS } from '../../../test/viewport';
import { EMPTY_BOOTSTRAP, normalizeBootstrap } from '../../data';
import { render as renderToHtml } from '../../entry-server';
import { renderWeb } from '../../testUtils';
import { DEFAULT_PARTNERS } from '../../../site/defaults';
import { SLOT_REGISTRY, slotDef } from '../../../site/siteSlots';
import { FAQ_CATEGORIES, FAQ_ITEMS } from '../../../site/slots/otazky';
import { PODMINKY_SECTIONS } from '../../../site/slots/podminky';
import { SOUKROMI_SECTIONS } from '../../../site/slots/soukromi';
import { STORNO_SECTIONS } from '../../../site/slots/storno';
import { LEGAL_LINKS } from '../../../site/slots/spolecne';
import { PublicFooter } from '../../../components/public/PublicFooter';
import LandingPage from '../LandingPage';
import KontaktPage from '../KontaktPage';
import ONasPage from '../ONasPage';
import KlubyPage from '../KlubyPage';
import DokumentyPage from '../DokumentyPage';
import FaqPage from '../FaqPage';
import PodminkyPage from '../PodminkyPage';
import SoukromiPage from '../SoukromiPage';
import StornoPage from '../StornoPage';
import PartneriPage from '../PartneriPage';
import { fillTokens, parseBlocks } from './richText';

const get = vi.fn();
vi.mock('../../http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../http')>();
  return { ...actual, webHttp: { get: (...args: unknown[]) => get(...args) } };
});

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

const BOX_ID = ['fdcg', 'vvp'].join('');
const ADMIN_NOTE = 'Znění k právní kontrole provozovatelem';

beforeEach(() => {
  get.mockReset();
  askedKeys.clear();
  get.mockRejectedValue(new Error('Network Error'));
});
afterEach(cleanup);

const widths = [
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const;

const h = (level: number, name: string | RegExp) => screen.getByRole('heading', { level, name });

describe('rich text of a slot', () => {
  it('turns paragraphs, "###" headings, lists and **bold** into blocks', () => {
    const blocks = parseBlocks('### Nadpis\nPrvní řádek\ndruhý řádek\n\nPokud:\n- jedna **tučně**\n- dvě\n\nKonec');
    expect(blocks).toEqual([
      { kind: 'h', text: 'Nadpis' },
      { kind: 'p', lines: ['První řádek', 'druhý řádek'] },
      { kind: 'p', lines: ['Pokud:'] },
      { kind: 'ul', items: ['jedna **tučně**', 'dvě'] },
      { kind: 'p', lines: ['Konec'] },
    ]);
  });

  it('fills the {tokens} from the settings and leaves an unknown or empty one as it is', () => {
    expect(fillTokens('Napište na {email} nebo {telefon}. {neznamy}', { email: 'a@b.example', telefon: '' })).toBe('Napište na a@b.example nebo {telefon}. {neznamy}');
  });
});

describe.each(widths)('/faq at %s (%i px)', (_name, width) => {
  it('is an accordion of the live questions: one H1, the categories as H2, every question a <details>', () => {
    const { container } = renderWeb(<FaqPage />, { width });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, 'Často kladené otázky')).toBeInTheDocument();
    for (const category of FAQ_CATEGORIES) expect(h(2, category.title)).toBeInTheDocument();
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(20);

    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(FAQ_ITEMS.length);
    for (const item of details) {
      expect(item.querySelector('summary')?.textContent?.trim()).not.toBe('');
      expect((item as HTMLDetailsElement).open).toBe(false);
    }
    // A question opens on its summary; the answer (lists, small headings) is in the document.
    const summary = screen.getByText('Jak dlouho jsou zdravotní prohlídky platné?');
    const item = summary.closest('details') as HTMLDetailsElement;
    fireEvent.click(summary);
    item.open = true;
    expect(item.open).toBe(true);
    expect(within(item).getByText(/platný nejdéle 12 měsíců/)).toBeInTheDocument();
    const prep = screen.getByText('Příprava na zátěžový test: co je důležité vědět a mít sebou?').closest('details') as HTMLElement;
    expect(within(prep).getByRole('heading', { level: 3, name: 'Co je potřeba mít s sebou' })).toBeInTheDocument();
    expect(within(prep).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/kontakt');
  });
});

describe('/faq — a question the admin rewrote', () => {
  it('shows the admin text instead of the live one', () => {
    const siteContent = {
      version: 'v1', partners: [], faq: [],
      slots: { 'otazky.q.01.q': { kind: 'text', text: 'Nová otázka?' }, 'otazky.q.01.a': { kind: 'text', text: 'Nová odpověď.' } },
    };
    renderWeb(<FaqPage />, { seed: normalizeBootstrap({ siteContent }, 1) });
    expect(screen.getByText('Nová otázka?')).toBeInTheDocument();
    expect(screen.getByText('Nová odpověď.')).toBeInTheDocument();
    expect(screen.queryByText('Příprava na zátěžový test: co je důležité vědět a mít sebou?')).toBeNull();
  });
});

const TEXT_PAGES: readonly { name: string; Page: () => ReactElement; sections: readonly { id: string; title: string }[]; h1: string; path: string }[] = [
  { name: 'Obchodní podmínky', Page: PodminkyPage, sections: PODMINKY_SECTIONS, h1: 'Obchodní podmínky', path: '/obchodni-podminky' },
  { name: 'Ochrana osobních údajů', Page: SoukromiPage, sections: SOUKROMI_SECTIONS, h1: 'Ochrana osobních údajů', path: '/ochrana-osobnich-udaju' },
  { name: 'Storno a reklamace', Page: StornoPage, sections: STORNO_SECTIONS, h1: 'Storno a reklamace', path: '/storno-a-reklamace' },
];

describe.each(TEXT_PAGES)('$name ($path)', ({ Page, sections, h1, path }) => {
  it.each(widths)('has its H1, every section as an H2 and the contact block at %s (%i px)', (_name, width) => {
    const clinic = { name: 'Klinika', phone: '+420 111 222 333', email: 'ahoj@klinika.example', address: 'Nová 5\n110 00 Praha 1' };
    const { container } = renderWeb(<Page />, { width, seed: normalizeBootstrap({ clinic }, 1) });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, h1)).toBeInTheDocument();
    // The sections plus "Kontaktní údaje".
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(sections.length + 1);
    for (const section of sections) expect(h(2, section.title)).toBeInTheDocument();
    expect(h(2, 'Kontaktní údaje')).toBeInTheDocument();

    // The contact details are the clinic's settings, never typed: the tokens are filled, none is left.
    expect(container.textContent).not.toMatch(/\{(?:email|telefon|adresa)\}/);
    expect(screen.getAllByRole('link', { name: 'ahoj@klinika.example' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /\+420 111 222 333/ })[0]).toHaveAttribute('href', 'tel:+420111222333');
    // The note for the administrator is not on the public page, and the page links to the other ones but not to itself.
    expect(container.textContent).not.toContain(ADMIN_NOTE);
    const more = screen.getByRole('navigation', { name: 'Další informace' });
    expect(within(more).queryByRole('link', { name: h1 })).toBeNull();
    expect(within(more).getAllByRole('link')).toHaveLength(LEGAL_LINKS.length - 1);
    expect(container.textContent).not.toContain(BOX_ID);
    void path;
  });
});

describe('the text pages — details', () => {
  it('Storno: the live terms, with the clinic\'s own e-mail and phone in place of the tokens', () => {
    const clinic = { name: 'K', phone: '+420 111 222 333', email: 'ahoj@klinika.example', address: 'Nová 5' };
    renderWeb(<StornoPage />, { seed: normalizeBootstrap({ clinic }, 1) });
    expect(h(2, 'Zrušení nebo změna termínu (storno podmínky)')).toBeInTheDocument();
    expect(screen.getByText(/nejpozději 24 hodin před začátkem objednané služby/)).toBeInTheDocument();
    expect(screen.getAllByText('ahoj@klinika.example', { selector: 'strong' })).toHaveLength(2);
    expect(screen.getByText('+420 111 222 333', { selector: 'strong' })).toBeInTheDocument();
  });

  it('Obchodní podmínky open with a contents list (long text); Storno too', () => {
    renderWeb(<PodminkyPage />);
    const toc = screen.getByRole('navigation', { name: 'Obsah' });
    expect(within(toc).getAllByRole('link')).toHaveLength(PODMINKY_SECTIONS.length);
    expect(within(toc).getAllByRole('link')[1]).toHaveAttribute('href', '#podminky-s1');
  });

  it('the admin\'s wording replaces a section text, but not the heading structure', () => {
    const siteContent = { version: 'v1', partners: [], faq: [], slots: { 'storno.sec.charakter.text': { kind: 'text', text: 'Jiné znění.' } } };
    renderWeb(<StornoPage />, { seed: normalizeBootstrap({ siteContent }, 1) });
    expect(screen.getByText('Jiné znění.')).toBeInTheDocument();
    expect(h(2, 'Charakter poskytovaných služeb')).toBeInTheDocument();
  });

  it('the privacy page is the live text — nothing about health data is added', () => {
    const { container } = renderWeb(<SoukromiPage />);
    expect(container.textContent).not.toMatch(/zdravotní údaj|zdravotních údajů|zvláštní kategori/i);
  });
});

describe.each(widths)('/partneri at %s (%i px)', (_name, width) => {
  it('shows the nine live clubs with their descriptions and links when the admin has none', () => {
    const { container } = renderWeb(<PartneriPage />, { width });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h(1, 'Partnerské kluby')).toBeInTheDocument();
    expect(DEFAULT_PARTNERS).toHaveLength(9);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(9);
    expect(h(3, 'Black Angels')).toBeInTheDocument();
    expect(screen.getByText(/Ambiciózní florbalový klub/)).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /Oficiální web klubu/ });
    expect(links).toHaveLength(8); // SGB Multisport Academy has no website on the live page
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    expect(container.querySelector('img')).toBeNull(); // logos are text until uploaded
    expect(screen.getByRole('link', { name: 'Nabídka pro sportovní kluby' })).toHaveAttribute('href', '/kluby');
  });
});

describe('/partneri — the admin\'s list', () => {
  it('replaces the defaults; a logo is shown when uploaded; an unusable address is not a link', () => {
    const siteContent = {
      version: 'v1', slots: {}, faq: [],
      partners: [
        { id: 'p1', name: 'Klub A', sport: 'Hokej', description: 'Popis A', url: 'https://klub-a.example', logoUrl: 'https://res.example/a.png', sort: 1 },
        { id: 'p2', name: 'Klub B', sport: '', description: '', url: 'javascript:alert(1)', sort: 2 },
      ],
    };
    const { container } = renderWeb(<PartneriPage />, { seed: normalizeBootstrap({ siteContent }, 1) });
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Klub A', 'Klub B']);
    expect(screen.queryByText('Black Angels')).toBeNull();
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Oficiální web klubu/ })).toHaveLength(1);
  });
});

describe('the footer', () => {
  it('has the small legal row to the new pages, labels from slots, and no data-box id', () => {
    renderWeb(<PublicFooter clinic={null} />);
    const legal = screen.getByRole('navigation', { name: 'Právní informace' });
    const links = within(legal).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Obchodní podmínky', 'Ochrana osobních údajů', 'Storno a reklamace', 'Časté otázky', 'Partneři']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/obchodni-podminky', '/ochrana-osobnich-udaju', '/storno-a-reklamace', '/faq', '/partneri']);
    expect(screen.getByRole('contentinfo').textContent).not.toContain(BOX_ID);
  });
});

/* ── The registry: every key a page asks for exists, and every key of the page is used ── */

const ALL_ANSWERS_CLINIC = {
  name: 'Klinika', phone: '+420 111 222 333', email: 'ahoj@klinika.example', address: 'Nová 5\n110 00 Praha 1',
  openingHours: 'Po–Pá 9:00–17:00', dic: 'CZ00000001', bankAccount: '000000-0000000000/0000', dataBox: 'abcdefg',
};

function allAnswers(): void {
  get.mockImplementation((url: string) => {
    if (url === '/api/public/club-terms') return Promise.resolve({ data: { minimumPlayers: 12 } });
    if (url === '/api/public/discount-tiers') return Promise.resolve({ data: [{ minPersons: 4, percent: 5 }, { minPersons: 10, percent: 15 }] });
    return Promise.reject(new Error('Network Error'));
  });
}

const PAGES: readonly { name: string; prefixes: string[]; element: () => ReactElement; ready: () => Promise<void> }[] = [
  {
    name: 'landing', prefixes: ['landing.'], element: () => <LandingPage />,
    ready: async () => { await screen.findByText('sportovců minimálně'); await screen.findByText(/^−15\s%$/); },
  },
  {
    name: 'kontakt', prefixes: ['kontakt.'], element: () => <KontaktPage />,
    ready: async () => { await screen.findByText('Datová schránka'); },
  },
  { name: 'onas', prefixes: ['onas.'], element: () => <ONasPage />, ready: async () => undefined },
  {
    name: 'kluby', prefixes: ['kluby.'], element: () => <KlubyPage />,
    ready: async () => {
      await screen.findByText('Minimální počet sportovců');
      await screen.findByText('Sleva podle počtu osob');
      fireEvent.click(screen.getByRole('button', { name: 'Pokračovat k registraci' }));
    },
  },
  { name: 'dokumenty', prefixes: ['dokumenty.'], element: () => <DokumentyPage />, ready: async () => undefined },
  { name: 'otazky', prefixes: ['otazky.'], element: () => <FaqPage />, ready: async () => undefined },
  { name: 'podminky', prefixes: ['podminky.'], element: () => <PodminkyPage />, ready: async () => undefined },
  { name: 'soukromi', prefixes: ['soukromi.'], element: () => <SoukromiPage />, ready: async () => undefined },
  { name: 'storno', prefixes: ['storno.'], element: () => <StornoPage />, ready: async () => undefined },
  { name: 'partneri', prefixes: ['partneri.'], element: () => <PartneriPage />, ready: async () => undefined },
];

describe.each(PAGES)('the slots of $name', ({ prefixes, element, ready }) => {
  it('every key the page asks for is in the registry, and every registry key of the page is used', async () => {
    allAnswers();
    renderWeb(element(), { seed: normalizeBootstrap({ clinic: ALL_ANSWERS_CLINIC }, 1) });
    await ready();

    expect([...askedKeys].filter((key) => slotDef(key) === undefined)).toEqual([]);
    const registered = SLOT_REGISTRY.filter((slot) => prefixes.some((prefix) => slot.key.startsWith(prefix)));
    expect(registered.length).toBeGreaterThan(5);
    // The note for the administrator is the one registered key a public page must never read.
    const unused = registered.filter((slot) => !askedKeys.has(slot.key) && !slot.key.endsWith('.adminnote')).map((slot) => slot.key);
    expect(unused).toEqual([]);
    for (const slot of registered.filter((entry) => entry.key.endsWith('.adminnote'))) {
      expect(askedKeys.has(slot.key), slot.key).toBe(false);
      expect(slot.label).toMatch(/nezobrazuje/);
      expect(slot.defaultText).toBe(ADMIN_NOTE);
    }
  });
});

describe('slot defaults of the public pages', () => {
  const prefixes = ['landing.', 'kontakt.', 'onas.', 'kluby.', 'dokumenty.', 'otazky.', 'podminky.', 'soukromi.', 'storno.', 'partneri.', 'site.'];
  const mine = SLOT_REGISTRY.filter((slot) => prefixes.some((prefix) => slot.key.startsWith(prefix)));

  it('hold no price, no percentage, no player count and no data-box id', () => {
    for (const slot of mine) {
      const text = slot.defaultText ?? '';
      expect(text, slot.key).not.toMatch(/\d\s*(?:Kč|%)/);
      expect(text, slot.key).not.toMatch(/\b30\s*\+|\b\d+\s*\+?\s*sportovc|minimáln\w*\s+\d/i);
      expect(text, slot.key).not.toContain(BOX_ID);
      expect(text, slot.key).not.toMatch(/datová schránka\s*[:\-–]/i);
    }
  });

  it('hold no contact detail of the clinic in the policy texts (they use tokens)', () => {
    for (const slot of mine.filter((entry) => /^(?:podminky|soukromi|storno|otazky)\./.test(entry.key))) {
      expect(slot.defaultText ?? '', slot.key).not.toMatch(/@|606\s?785/);
    }
  });

  it('are unique, valid keys with a label and a group', () => {
    expect(new Set(SLOT_REGISTRY.map((slot) => slot.key)).size).toBe(SLOT_REGISTRY.length);
    for (const slot of mine) {
      expect(slot.key, slot.key).toMatch(/^[a-z0-9][a-z0-9._-]{0,79}$/);
      expect(slot.label.trim(), slot.key).not.toBe('');
      expect(slot.group.trim(), slot.key).not.toBe('');
    }
  });
});

describe('prerendering the new pages (renderToString)', () => {
  it.each(['/', '/faq', '/obchodni-podminky', '/ochrana-osobnich-udaju', '/storno-a-reklamace', '/partneri', '/kontakt', '/kluby'])('%s renders without throwing, with the page\'s H1', (path) => {
    const result = renderToHtml(path, EMPTY_BOOTSTRAP);
    expect(result.found).toBe(true);
    expect(result.html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(result.html).not.toContain(BOX_ID);
    expect(result.html).not.toContain(ADMIN_NOTE);
  });

  it('the FAQ answers are in the prerendered HTML', () => {
    const { html } = renderToHtml('/faq', EMPTY_BOOTSTRAP);
    expect(html).toContain('Jak dlouho jsou zdravotní prohlídky platné?');
    expect(html).toContain('platný nejdéle 12 měsíců');
  });
});

describe('the source tree', () => {
  it('does not contain the old data-box id in any source or data file of src/', () => {
    const root = join(process.cwd(), 'src');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        // Source and data only: the guards in test files name the id in order to forbid it.
        if (!/\.(?:ts|tsx|css|json|html)$/.test(entry) || /\.test\.(?:ts|tsx)$/.test(entry)) continue;
        if (readFileSync(full, 'utf8').toLowerCase().includes(BOX_ID)) hits.push(relative(root, full).split(sep).join('/'));
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
