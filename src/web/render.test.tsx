import { describe, expect, it } from 'vitest';
import { WEB_ROUTES } from './routes';
import { render } from './entry-server';
import { EMPTY_BOOTSTRAP, normalizeBootstrap } from './data';
import { TEST_PRICE_LIST } from './testUtils';

/* The server render (what scripts/prerender.mjs calls once per route). It must work with no API at all
   and, given the API's answers, put the real numbers in the HTML. */

describe('render() — the prerender entry', () => {
  it('renders every route to HTML with exactly one H1, a title and its own CSS, with no API', () => {
    for (const route of WEB_ROUTES) {
      const result = render(route.path, EMPTY_BOOTSTRAP);
      expect(result.found, route.path).toBe(true);
      expect(result.title).toBe(route.title);
      expect(result.description).toBe(route.description);
      expect(result.html.match(/<h1[\s>]/g), route.path).toHaveLength(1);
      expect(result.html).toContain('<header');
      expect(result.html).toContain('<footer');
      expect(result.styles).toContain('data-emotion="css');
    }
  });

  it('puts the H1, the service names and the footer in the landing HTML', () => {
    const { html } = render('/web', EMPTY_BOOTSTRAP);
    const h1 = /<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect(h1.replace(/<[^>]+>/g, '|')).toMatch(/Výkon,.*který se dá.*změřit/);
    expect(h1.match(/<br\/>/g)).toHaveLength(2);
    for (const name of ['Sportovní lékařské prohlídky', 'Sportovní diagnostika', 'InBody 770']) expect(html).toContain(name);
    expect(html).toContain('Mám odkaz od klubu');
    expect(html).toContain('Provozní doba');
  });

  it('puts no amount in the HTML when the price list is unknown — a dash, never a remembered number', () => {
    const { html } = render('/web', EMPTY_BOOTSTRAP);
    expect(html).not.toMatch(/\d(?:&nbsp;|\s| )*Kč/);
    expect(html).toContain('—');
  });

  it('puts the prices of the build-time snapshot in the HTML', () => {
    const data = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    const { html } = render('/web', data);
    expect(html).toMatch(/1 234 Kč/);
    expect(html).toMatch(/4 567 Kč/);
    // "Ceník od …" is the cheapest item of the list.
    expect(html).toMatch(/Ceník od 678 Kč/);
    expect(render('/web', data).data).toBe(data);
  });

  it('renders the not-found page for an address that is not in the table', () => {
    const result = render('/web/neexistuje', EMPTY_BOOTSTRAP);
    expect(result.found).toBe(false);
    expect(result.html).toContain('Stránka nenalezena');
  });

  it('is deterministic: the same input gives the same HTML (so hydration matches)', () => {
    const data = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    expect(render('/web', data).html).toBe(render('/web', data).html);
  });
});

describe('normalizeBootstrap', () => {
  it('turns missing or broken answers into nulls instead of throwing', () => {
    const data = normalizeBootstrap({ priceList: 'x', clinic: null, siteContent: 12, discountTiers: undefined }, 5);
    expect(data).toEqual({ builtAt: 5, priceList: null, clinic: null, siteContent: null, discountTiers: null });
  });

  it('keeps what the API did send', () => {
    const data = normalizeBootstrap({
      priceList: { success: true, data: TEST_PRICE_LIST },
      clinic: { name: 'K', email: 'a@b.cz', phone: '+420 1', address: 'Praha', openingHours: ' Po–Pá ' },
      discountTiers: [{ minPersons: 10, percent: 15 }],
    });
    expect(data.priceList).toHaveLength(3);
    expect(data.clinic).toMatchObject({ phone: '+420 1', openingHours: 'Po–Pá', bookingEnabled: true });
    expect(data.discountTiers).toEqual([{ minPersons: 10, percent: 15 }]);
  });
});
