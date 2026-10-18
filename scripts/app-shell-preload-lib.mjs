/* ══════════════════════════════════════════════════════════════
   THE APPLICATION'S FIRST SCREEN, ANNOUNCED IN dist/app.html — PURE HELPERS

   The staff portal and the patients' app pages are served from the SPA shell dist/app.html. Vite's shell holds one
   script (the tiny entry), which imports the application's entry on demand, which imports its parts, which import the
   screen's chunk: a chain of four round trips before the first byte of data is asked for (170 ms each on a phone).

   scripts/app-shell-preload.mjs writes into the shell, from Vite's manifest, what that chain will need anyway:
     - the application entry and everything it imports statically, as <link rel="modulepreload">, plus its CSS and the
       two font faces the first screen is set in - all fetched in parallel with the entry instead of one after another;
     - a small inline script that, by address, also preloads the chunk of THAT screen (and, for a signed-in browser, the
       staff portal's chunk), so the screen's code arrives together with the entry; it also answers
       `window.__smPrefetch(path)` for src/prefetchRoutes.ts, which fetches the NEXT likely screens' scripts in idle time.
   Nothing here changes what runs, only when the browser starts fetching it. Pure functions: no file or network access
   (src/web/appShellPreload.test.ts).
   ══════════════════════════════════════════════════════════════ */

import { assetsForEntry, escapeHtml, pickFontPreloads, safeJson } from './prerender-lib.mjs';

export const APP_ENTRY = 'src/web/appEntry.tsx';
export const STAFF_APP = 'src/StaffApp.tsx';

/**
 * The screens worth announcing, as [address pattern, manifest key of the screen's chunk, needs the signed-in portal].
 * The pattern is tested against `location.pathname`. A key that is not in the manifest is skipped (a screen that was
 * renamed must never fail the build - the page then simply loads it the usual way).
 */
export const SCREENS = [
  ['^/login$', 'src/pages/Login.tsx', false],
  ['^/objednat$', 'src/pages/public/PublicBooking.tsx', false],
  ['^/prehled$', 'src/pages/Dashboard.tsx', true],
  ['^/planovani$', 'src/planner/PlannerPage.tsx', true],
  ['^/clubs$', 'src/pages/ClubsPage.tsx', true],
  ['^/clubs/[0-9a-fA-F-]{36}$', 'src/planner/ClubPlannerPage.tsx', true],
  ['^/patients$', 'src/pages/PatientList.tsx', true],
  ['^/settings(/.*)?$', 'src/pages/Settings.tsx', true],
  ['^/dnes$', 'src/pages/booking/DayOverviewPage.tsx', true],
  ['^/billing$', 'src/pages/Billing.tsx', true],
  ['^/patients/[0-9a-fA-F-]{8,}$', 'src/pages/patients/PatientLayout.tsx', true],
  ['^/clubs/objednavky$', 'src/pages/clubs/orders/ClubOrdersPage.tsx', true],
  ['^/clubs/rezervace$', 'src/pages/clubs/ClubReservationsPage.tsx', true],
  ['^/clubs/hraci$', 'src/pages/clubs/ClubPlayersPage.tsx', true],
  ['^/clubs/statistiky$', 'src/pages/clubs/ClubStatsPage.tsx', true],
  ['^/clubs/fakturace$', 'src/pages/clubs/ClubBillingPage.tsx', true],
];

/** The faces the first screen of the application is set in (Latin and Latin-ext, which carries Czech). */
export const APP_FONT_FACES = [/^public-sans-latin(?:-ext)?-400-normal/, /^public-sans-latin(?:-ext)?-600-normal/];

/** Marks the block, so a second run replaces it instead of adding another. */
export const BLOCK_START = '<!--app-preload:start-->';
export const BLOCK_END = '<!--app-preload:end-->';

function filesOf(manifest, key) {
  return manifest[key] === undefined ? { js: [], css: [] } : assetsForEntry(manifest, key);
}

/**
 * The preload block for the SPA shell.
 * @param {Record<string, any>} manifest  Vite's dist/.vite/manifest.json
 * @param {string} appCss  the text of the application entry's CSS (where the font faces are declared)
 * @returns {{ html: string, report: { entryJs: number, entryCss: number, fonts: number, screens: number, skipped: string[] } }}
 */
export function buildPreloadBlock(manifest, appCss) {
  const entry = filesOf(manifest, APP_ENTRY);
  if (entry.js.length === 0) throw new Error(`app-shell-preload: ${APP_ENTRY} is not in the manifest - run \`vite build\` first`);

  const tags = [];
  for (const file of entry.js) tags.push(`<link rel="modulepreload" crossorigin href="${escapeHtml(file)}" />`);
  for (const file of entry.css) tags.push(`<link rel="stylesheet" crossorigin href="${escapeHtml(file)}" />`);
  const fonts = pickFontPreloads(appCss, APP_FONT_FACES);
  for (const font of fonts) tags.push(`<link rel="preload" as="font" type="font/woff2" crossorigin href="${escapeHtml(font)}" />`);

  /* what each address adds beyond the entry (the entry's own files are already announced above) */
  const known = new Set(entry.js);
  const staff = filesOf(manifest, STAFF_APP);
  const staffJs = staff.js.filter((f) => !known.has(f));
  const staffCss = staff.css.filter((f) => !entry.css.includes(f));
  const rules = [];
  const skipped = [];
  for (const [pattern, key, needsPortal] of SCREENS) {
    if (manifest[key] === undefined) {
      skipped.push(key);
      continue;
    }
    const screen = filesOf(manifest, key);
    const js = screen.js.filter((f) => !known.has(f) && !(needsPortal && staffJs.includes(f)));
    const css = screen.css.filter((f) => !entry.css.includes(f) && !(needsPortal && staffCss.includes(f)));
    rules.push([pattern, needsPortal ? 1 : 0, js, css]);
  }
  /* Plain ES5 so it runs in anything. `run(path, now, portal)`: `now` = this page's own address (its styles apply at
     once), otherwise a look-ahead - the scripts are fetched and the styles only prefetched, so a screen that is not open
     yet changes nothing on the one that is. `portal` = the person is about to sign in, so fetch the portal as well. */
  const script =
    '(function(){try{var S=' +
    safeJson({ js: staffJs, css: staffCss }) +
    ',R=' +
    safeJson(rules) +
    ',h=document.head,seen={},' +
    'add=function(rel,f,as){var k=rel+f;if(seen[k])return;seen[k]=1;var l=document.createElement("link");l.rel=rel;if(as)l.as=as;l.crossOrigin="";l.href=f;h.appendChild(l)},' +
    'css=function(f,now){if(now)add("stylesheet",f);else add("prefetch",f,"style")},' +
    'run=function(p,now,portal){for(var i=0;i<R.length;i++){if(new RegExp(R[i][0]).test(p)){' +
    'if(R[i][1]){if(!portal&&!localStorage.getItem("token"))return;S.js.forEach(function(f){add("modulepreload",f)});S.css.forEach(function(f){css(f,now)})}' +
    'R[i][2].forEach(function(f){add("modulepreload",f)});R[i][3].forEach(function(f){css(f,now)});return}}};' +
    'window.__smPrefetch=function(p,portal){try{run(p,false,!!portal)}catch(e){}};' +
    'run(location.pathname,true,false)}catch(e){}})();';

  const html = `${BLOCK_START}\n    ${tags.join('\n    ')}\n    <script>${script}</script>\n    ${BLOCK_END}`;
  return {
    html,
    report: { entryJs: entry.js.length, entryCss: entry.css.length, fonts: fonts.length, screens: rules.length, skipped },
  };
}

/** Writes (or replaces) the block just before </head>. */
export function injectPreloadBlock(shellHtml, block) {
  if (!shellHtml.includes('</head>')) throw new Error('app-shell-preload: the shell has no </head>');
  if (shellHtml.includes('data-prerendered')) throw new Error('app-shell-preload: this is a prerendered page, not the SPA shell');
  let out = shellHtml;
  const a = out.indexOf(BLOCK_START);
  const b = out.indexOf(BLOCK_END);
  if (a !== -1 && b > a) out = out.slice(0, a).replace(/[ \t]*$/, '') + out.slice(b + BLOCK_END.length).replace(/^\n?/, '');
  return out.replace('</head>', `  ${block}\n  </head>`);
}
