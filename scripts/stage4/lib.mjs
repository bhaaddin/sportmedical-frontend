/* Shared helpers of the stage-4 checks: our own headless Chromium, the dev login (never printed), the worktree's Vite on :3008. */
import './env.mjs';
export * from '../club-planning/lib.mjs';
import { OUT } from '../club-planning/lib.mjs';

export const SIZES4 = {
  phone: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
  wide: { width: 1920, height: 1080, isMobile: false, hasTouch: false },
};

/** A small JPEG screenshot (disk is tight). */
export const jpg = (page, name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 62 });

/** The page's geometry facts every check wants. */
export const facts = (page) => page.evaluate(() => ({
  docScroll: document.documentElement.scrollHeight - innerHeight,
  hOverflow: document.documentElement.scrollWidth - innerWidth,
}));
