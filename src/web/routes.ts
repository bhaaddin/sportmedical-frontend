/* ══════════════════════════════════════════════════════════════
   THE ROUTE TABLE OF THE PUBLIC SITE (the root of the domain)

   One entry per page. The prerender script writes dist/<path>/index.html for each
   of them (the landing page is dist/index.html), the router renders them, the
   title/description come from here. The addresses themselves are in sitePaths.ts, a
   file that imports nothing, so main.tsx and the application can ask "is this a public
   page?" without loading the pages.

   To add a page: a component under src/web/pages/, a line in SITE_PAGES (sitePaths.ts),
   its entry in PAGE_DETAILS below (TypeScript enforces it), a slots file in
   src/site/slots/ if it has editable content, and a rewrite line in vercel.json.

   Pages are imported statically on purpose: renderToString does not wait for
   React.lazy, and every page is small content built from shared blocks.
   ══════════════════════════════════════════════════════════════ */

import type { ComponentType } from 'react';
import LandingPage from './pages/LandingPage';
import SluzbyPage from './pages/SluzbyPage';
import ProhlidkyPage from './pages/ProhlidkyPage';
import DiagnostikaPage from './pages/DiagnostikaPage';
import InBodyPage from './pages/InBodyPage';
import CenikPage from './pages/CenikPage';
import DokumentyPage from './pages/DokumentyPage';
import KontaktPage from './pages/KontaktPage';
import ONasPage from './pages/ONasPage';
import KlubyPage from './pages/KlubyPage';
import FaqPage from './pages/FaqPage';
import PodminkyPage from './pages/PodminkyPage';
import SoukromiPage from './pages/SoukromiPage';
import StornoPage from './pages/StornoPage';
import VybaveniPage from './pages/VybaveniPage';
import PartneriPage from './pages/PartneriPage';
import DiagZakladniPage from './pages/DiagZakladniPage';
import DiagKomplexniPage from './pages/DiagKomplexniPage';
import DiagVo2maxPage from './pages/DiagVo2maxPage';
import DiagKompenzacniPage from './pages/DiagKompenzacniPage';
import { SITE_PAGES, normalizeSitePath } from './sitePaths';
import type { SitePageId } from './sitePaths';

export { normalizeSitePath as normalizeWebPath };

export interface WebRoute {
  /** Stable id (also the slot-file name): 'landing', 'sluzby', … */
  id: string;
  /** The URL path, no trailing slash: '/', '/sluzby'. */
  path: string;
  /** Short name for breadcrumbs / sitemaps. */
  label: string;
  /** <title> — what the browser tab and a search result show. */
  title: string;
  /** <meta name="description">. */
  description: string;
  Component: ComponentType;
}

const BRAND = 'SportMedical Diagnostics';

type PageDetails = Omit<WebRoute, 'id' | 'path'>;

/** Everything about a page that is not its address. Keyed by the ids of SITE_PAGES: a page without an entry does not compile. */
const PAGE_DETAILS: Record<SitePageId, PageDetails> = {
  landing: {
    label: 'Úvod', Component: LandingPage,
    title: `${BRAND} — sportovní lékařské prohlídky a diagnostika v Praze`,
    description: 'Sportovní lékařské prohlídky, zátěžová diagnostika a analýza složení těla InBody 770. Klinika sportovní medicíny v Praze 4, termín online za dvě minuty.',
  },
  sluzby: {
    label: 'Služby', Component: SluzbyPage,
    title: `Služby — ${BRAND}`,
    description: 'Sportovní lékařské prohlídky, sportovní diagnostika a InBody 770: tři okruhy služeb jedné kliniky.',
  },
  prohlidky: {
    label: 'Sportovní lékařské prohlídky', Component: ProhlidkyPage,
    title: `Sportovní lékařské prohlídky — ${BRAND}`,
    description: 'Posouzení zdravotní způsobilosti ke sportu: základní, komplexní prohlídka a spiroergometrie. Objednání online.',
  },
  diagnostika: {
    label: 'Sportovní diagnostika', Component: DiagnostikaPage,
    title: `Sportovní diagnostika — ${BRAND}`,
    description: 'Silové desky ForceDecks, 3D analýza pohybu HumanTrak a VO₂max. Čísla, podle kterých se dá upravit trénink.',
  },
  inbody: {
    label: 'InBody 770', Component: InBodyPage,
    title: `InBody 770 — analýza složení těla — ${BRAND}`,
    description: 'Svalová hmota, tuk, voda a rovnováha mezi segmenty těla. Měření InBody 770 a výživový plán.',
  },
  cenik: {
    label: 'Ceník', Component: CenikPage,
    title: `Ceník služeb — ${BRAND}`,
    description: 'Aktuální ceník sportovních prohlídek, diagnostiky a InBody měření.',
  },
  dokumenty: {
    label: 'Dokumenty', Component: DokumentyPage,
    title: `Dokumenty k testům — ${BRAND}`,
    description: 'Formuláře ke stažení a doporučení před vyšetřením: co si vzít s sebou a jak se připravit.',
  },
  kontakt: {
    label: 'Kontakt', Component: KontaktPage,
    title: `Kontakt — ${BRAND}`,
    description: 'Adresa, telefon, e-mail a ordinační hodiny kliniky v Praze 4 – Michle.',
  },
  onas: {
    label: 'O nás', Component: ONasPage,
    title: `O nás — ${BRAND}`,
    description: 'Klinika sportovní medicíny: lékaři, přístroje a přístup, na kterém stavíme.',
  },
  kluby: {
    label: 'Pro kluby', Component: KlubyPage,
    title: `Pro kluby — mobilní testování týmů — ${BRAND}`,
    description: 'Testování celého týmu přímo ve vašem klubu po celé ČR, jeden odkaz pro všechny sportovce.',
  },
  otazky: {
    label: 'Často kladené otázky', Component: FaqPage,
    title: 'Časté otázky — SportMedical Diagnostics',
    description: 'Odpovědi na nejčastější otázky: příprava na test, délka vyšetření, platnost, InBody, diagnostika.',
  },
  podminky: {
    label: 'Obchodní podmínky', Component: PodminkyPage,
    title: 'Obchodní podmínky — SportMedical Diagnostics',
    description: 'Podmínky poskytování služeb kliniky.',
  },
  soukromi: {
    label: 'Ochrana osobních údajů', Component: SoukromiPage,
    title: 'Ochrana osobních údajů — SportMedical Diagnostics',
    description: 'Jak klinika zpracovává osobní a zdravotní údaje.',
  },
  storno: {
    label: 'Storno a reklamace', Component: StornoPage,
    title: 'Storno a reklamace — SportMedical Diagnostics',
    description: 'Zrušení termínu, nedostavení se a reklamace služeb.',
  },
  vybaveni: {
    label: 'Vybavení', Component: VybaveniPage,
    title: 'Vybavení kliniky — SportMedical Diagnostics',
    description: 'Přístroje, na kterých vás měříme.',
  },
  partneri: {
    label: 'Partnerské kluby', Component: PartneriPage,
    title: 'Partneři — SportMedical Diagnostics',
    description: 'Kluby a organizace, se kterými spolupracujeme.',
  },
  diagzakladni: {
    label: 'Základní diagnostika', Component: DiagZakladniPage,
    title: 'Základní diagnostika — SportMedical Diagnostics',
    description: 'Základní sportovní diagnostika: co měříme a pro koho je.',
  },
  diagkomplexni: {
    label: 'Komplexní diagnostika', Component: DiagKomplexniPage,
    title: 'Komplexní diagnostika — SportMedical Diagnostics',
    description: 'Komplexní sportovní diagnostika včetně videobiomechanické analýzy.',
  },
  diagvo2max: {
    label: 'VO₂max analýza', Component: DiagVo2maxPage,
    title: 'VO₂max analýza — SportMedical Diagnostics',
    description: 'Spiroergometrie a analýza VO₂max.',
  },
  diagkompenzacni: {
    label: 'Kompenzační plán', Component: DiagKompenzacniPage,
    title: 'Kompenzační plán — SportMedical Diagnostics',
    description: 'Individuální videoinstruovaný kompenzační plán.',
  },
};

export const WEB_ROUTES: WebRoute[] = SITE_PAGES.map((page) => ({ ...page, ...PAGE_DETAILS[page.id] }));

export const NOT_FOUND_META = {
  title: `Stránka nenalezena — ${BRAND}`,
  description: 'Tuto stránku jsme nenašli.',
} as const;

export function findWebRoute(url: string): WebRoute | undefined {
  const path = normalizeSitePath(url);
  return WEB_ROUTES.find((route) => route.path === path);
}

/** Where the prerendered file of a route is written, relative to the output directory: '/' → 'index.html'. */
export function routeOutputFile(route: Pick<WebRoute, 'path'>): string {
  return route.path === '/' ? 'index.html' : `${route.path.replace(/^\//, '')}/index.html`;
}
