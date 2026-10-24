/* Shared helpers of the stage-6 checks: club-planning's own-Chromium helpers pointed at this worktree's Vite (:3011). */
import './env.mjs';
export * from '../club-planning/lib.mjs';

/** JPEG, quality 55: the disk is tight, the evidence only needs to be readable. */
export const shot = (page, name) => page.screenshot({ path: `${process.env.OUT}/${name}.jpg`, type: 'jpeg', quality: 55 });
