/* R9: the činnost cards strip - how many cards are whole inside the strip, per width and per number of činnosti. */
import { launch, newPage, login, api, shot, startOrderIn, SIZES } from './lib.mjs';
const label = process.argv[2] ?? 'before';
const sizes = (process.argv[3] ?? 'desktop,tablet,phone').split(',');
const P = ['Základní sportovní prohlídka', 'Komplexní sportovní prohlídka', 'Spiroergometrické vyšetření'];
const D = ['Základní diagnostika', 'Komplexní diagnostika', 'VO₂max analýza', 'Individuální videoinstruovaný kompenzační plán'];
const B = ['Komplexní prohlídka + Základní diagnostika', 'Komplexní prohlídka + Komplexní diagnostika', 'Spiroergometrie + Základní diagnostika', 'Spiroergometrie + Komplexní diagnostika', 'Komplexní diagnostika + VO₂max analýza'];
const SETS = {
  1: ['prohlídky', P.slice(0, 1)], 2: ['prohlídky', P.slice(0, 2)], 3: ['prohlídky', P], 4: ['diagnostika', D], 5: ['balíčky', B],
};
const only = process.argv[4] ? process.argv[4].split(',').map(Number) : [1, 2, 3, 4, 5];
const browser = await launch();
for (const size of sizes) {
  for (const n of only) {
    const page = await newPage(browser, size);
    await login(page);
    const club = (await api(page, 'GET', '/api/clubs')).json.find((c) => c.name === 'ZZ test plánování');
    await startOrderIn(page, club.id, SETS[n][0], SETS[n][1].map((x) => [x, 2]));
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const vp = document.querySelector('#adaptive-viewport');
      const r = vp.getBoundingClientRect();
      const cards = [...vp.querySelectorAll('.plan-card')].map((c) => {
        const b = c.getBoundingClientRect();
        return { name: c.textContent.trim().slice(0, 22), x: Math.round(b.x), w: Math.round(b.width), whole: b.left >= r.left - 1 && b.right <= r.right + 1 && Number(getComputedStyle(c).opacity) > 0.9 && getComputedStyle(c).visibility === 'visible', partly: b.right > r.left && b.left < r.right };
      });
      const sum = document.querySelector('.s42-summary-card');
      return {
        viewport: { x: Math.round(r.x), w: Math.round(r.width) },
        dataVisible: vp.dataset.visible, deckN: getComputedStyle(document.querySelector('#planning-cards')).getPropertyValue('--deck-n'),
        scrollWidth: vp.scrollWidth, clientWidth: vp.clientWidth,
        cards, more: [...document.querySelectorAll('[data-deck-more]')].map((e) => e.textContent.trim()),
        sumX: sum ? Math.round(sum.getBoundingClientRect().x) : null,
        docScroll: document.documentElement.scrollWidth > innerWidth,
      };
    });
    const whole = info.cards.filter((c) => c.whole).length;
    console.log(`[${size} ${SIZES[size].width}px] n=${n}: whole=${whole}/${info.cards.length} dataVisible=${info.dataVisible} deckN=${info.deckN} strip=${info.viewport.w}px scrollW=${info.scrollWidth}/${info.clientWidth} more=${JSON.stringify(info.more)} cards=${info.cards.map((c) => `${c.w}${c.whole ? 'W' : c.partly ? 'p' : '-'}`).join(',')} docScrollX=${info.docScroll}`);
    await shot(page, `r9-${label}-${size}-n${n}`);
    await page.context().close();
  }
}
await browser.close();
