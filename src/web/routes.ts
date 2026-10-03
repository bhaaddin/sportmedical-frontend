/* ══════════════════════════════════════════════════════════════
   THE ROUTE TABLE OF THE PUBLIC SITE (/web/*)

   One entry per page. The prerender script writes dist/<path>/index.html for each
   of them, the router renders them, the sitemap/meta come from here. To add a
   page: a component under src/web/pages/, an entry here (and a slots file in
   src/site/slots/ if it has editable content) — and a rewrite line in vercel.json.

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

export interface WebRoute {
  /** Stable id (also the slot-file name): 'landing', 'sluzby', … */
  id: string;
  /** The URL path, no trailing slash: '/web', '/web/sluzby'. */
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

export const WEB_ROUTES: WebRoute[] = [
  {
    id: 'landing', path: '/web', label: 'Úvod', Component: LandingPage,
    title: `${BRAND} — sportovní lékařské prohlídky a diagnostika v Praze`,
    description: 'Sportovní lékařské prohlídky, zátěžová diagnostika a analýza složení těla InBody 770. Klinika sportovní medicíny v Praze 4, termín online za dvě minuty.',
  },
  {
    id: 'sluzby', path: '/web/sluzby', label: 'Služby', Component: SluzbyPage,
    title: `Služby — ${BRAND}`,
    description: 'Sportovní lékařské prohlídky, sportovní diagnostika a InBody 770: tři okruhy služeb jedné kliniky.',
  },
  {
    id: 'prohlidky', path: '/web/prohlidky', label: 'Sportovní lékařské prohlídky', Component: ProhlidkyPage,
    title: `Sportovní lékařské prohlídky — ${BRAND}`,
    description: 'Posouzení zdravotní způsobilosti ke sportu: základní, komplexní prohlídka a spiroergometrie. Objednání online.',
  },
  {
    id: 'diagnostika', path: '/web/diagnostika', label: 'Sportovní diagnostika', Component: DiagnostikaPage,
    title: `Sportovní diagnostika — ${BRAND}`,
    description: 'Silové desky ForceDecks, 3D analýza pohybu HumanTrak a VO₂max. Čísla, podle kterých se dá upravit trénink.',
  },
  {
    id: 'inbody', path: '/web/inbody', label: 'InBody 770', Component: InBodyPage,
    title: `InBody 770 — analýza složení těla — ${BRAND}`,
    description: 'Svalová hmota, tuk, voda a rovnováha mezi segmenty těla. Měření InBody 770 a výživový plán.',
  },
  {
    id: 'cenik', path: '/web/cenik', label: 'Ceník', Component: CenikPage,
    title: `Ceník služeb — ${BRAND}`,
    description: 'Aktuální ceník sportovních prohlídek, diagnostiky a InBody měření.',
  },
  {
    id: 'dokumenty', path: '/web/dokumenty', label: 'Dokumenty', Component: DokumentyPage,
    title: `Dokumenty k testům — ${BRAND}`,
    description: 'Formuláře ke stažení a doporučení před vyšetřením: co si vzít s sebou a jak se připravit.',
  },
  {
    id: 'kontakt', path: '/web/kontakt', label: 'Kontakt', Component: KontaktPage,
    title: `Kontakt — ${BRAND}`,
    description: 'Adresa, telefon, e-mail a ordinační hodiny kliniky v Praze 4 – Michle.',
  },
  {
    id: 'onas', path: '/web/o-nas', label: 'O nás', Component: ONasPage,
    title: `O nás — ${BRAND}`,
    description: 'Klinika sportovní medicíny: lékaři, přístroje a přístup, na kterém stavíme.',
  },
  {
    id: 'kluby', path: '/web/kluby', label: 'Pro kluby', Component: KlubyPage,
    title: `Pro kluby — mobilní testování týmů — ${BRAND}`,
    description: 'Testování celého týmu přímo ve vašem klubu po celé ČR, jeden odkaz pro všechny sportovce.',
  },
];

export const NOT_FOUND_META = {
  title: `Stránka nenalezena — ${BRAND}`,
  description: 'Tuto stránku jsme nenašli.',
} as const;

/** '/web/sluzby/?x=1#y' → '/web/sluzby' */
export function normalizeWebPath(url: string): string {
  const path = url.split('#')[0].split('?')[0];
  const trimmed = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return trimmed === '' ? '/' : trimmed;
}

export function findWebRoute(url: string): WebRoute | undefined {
  const path = normalizeWebPath(url);
  return WEB_ROUTES.find((route) => route.path === path);
}

/** Where the prerendered file of a route is written, relative to the output directory. */
export function routeOutputFile(route: Pick<WebRoute, 'path'>): string {
  return `${route.path.replace(/^\//, '')}/index.html`;
}
