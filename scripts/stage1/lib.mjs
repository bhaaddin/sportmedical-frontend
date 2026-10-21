/* Shared helpers of the stage-1 checks: club-planning's own-Chromium helpers, pointed at the worktree's Vite (:3004). */
import './env.mjs';
export * from '../club-planning/lib.mjs';

import { api as _api, waitPlanner as _wait, BASE as _BASE } from '../club-planning/lib.mjs';

/** Like startClubOrder, but the služba is chosen by (part of) its name and the činnosti are an array [name, seats]. */
export async function startOrderIn(page, clubId, serviceName, seats) {
  await page.goto(`${_BASE}/clubs/${clubId}`);
  await _wait(page);
  await page.click('[data-testid=ov-new-order], [data-testid=deck-empty-new]');
  await page.click('[data-testid=entry-phone]');
  await page.locator('[role=dialog] [role=combobox]').nth(1).click();
  await page.locator('[role=option]').filter({ hasText: serviceName }).first().click();
  for (const [name, n] of seats) {
    const row = page.locator('[data-testid=order-activity]').filter({ hasText: name }).first();
    await row.locator('input[type=checkbox]').check();
    await page.getByLabel(`Počet hráčů, ${name}`).fill(String(n));
  }
  await page.getByRole('button', { name: 'Vybrat termíny v kalendáři' }).click();
  await page.waitForTimeout(2500);
}
