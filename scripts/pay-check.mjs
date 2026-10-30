/*
 * Platby in a real browser (own headless Chromium, private context, mocks in that context only):
 *   BASE=http://localhost:3104 node scripts/pay-check.mjs
 * Seeds a staff session in the private context and answers the API with ZZ test data (no backend needed: the invoices
 * and the payment ledger), and photographs Fakturace (Doklady, Platby, the pay dialog with the QR) at 390x844 and 1440x900, light and dark.
 * Asserts: the document never scrolls, nothing overflows sideways, no page error, 44 px targets under 1280.
 */
import { mkdirSync } from 'node:fs';
import { findChrome, loadPlaywright } from './pw-env.mjs';

const BASE = process.env.BASE ?? 'http://localhost:3104';
const OUT = process.env.OUT_DIR ?? 'C:/Users/Matko/vt-tmp/shots';
mkdirSync(OUT, { recursive: true });

const now = new Date().toISOString();
const later = new Date(Date.now() + 365 * 86400_000).toISOString();
const invoices = [
  { id: 'zz-a', patientId: 'zz-p1', patientName: 'ZZ test Novák', invoiceNumber: 'ZZ-0001', status: 'Issued', totalCzk: 2200, paidCzk: 0, remainingCzk: 2200, currency: 'CZK', issueDateUtc: now, dueDateUtc: later, items: [], payments: [] },
  { id: 'zz-b', patientId: 'zz-p2', patientName: 'ZZ test Dvořák', invoiceNumber: 'ZZ-0002', status: 'Paid', totalCzk: 500, paidCzk: 500, remainingCzk: 0, currency: 'CZK', issueDateUtc: now, dueDateUtc: later, items: [], payments: [{ id: 'x', amountCzk: 500, method: 'Cash', paidAtUtc: now, note: null }] },
];
const base = { currency: 'CZK', refundedAmountCzk: 0, needsReview: false, createdBy: 'ZZ test', createdAtUtc: now };
const payments = [
  { ...base, id: 'pp1', invoiceId: 'zz-a', amountCzk: 2200, netPaidCzk: 0, method: 'Transfer', status: 'Pending', variableSymbol: '20260001' },
  { ...base, id: 'pp2', invoiceId: 'zz-b', amountCzk: 500, netPaidCzk: 500, method: 'Cash', status: 'Paid', paidAtUtc: now },
  { ...base, id: 'pp3', invoiceId: 'zz-a', amountCzk: 100, netPaidCzk: 0, method: 'Transfer', status: 'Pending', needsReview: true, reviewReason: 'late_payment', variableSymbol: '20260001' },
];
const qrSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h3v3H0zM5 0h3v3H5zM0 5h3v3H0zM4 4h1v1H4zM6 6h2v2H6z"/></svg>';
const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const pw = await loadPlaywright();
const browser = await pw.chromium.launch({ headless: true, executablePath: findChrome() });
const failures = [];
for (const [label, w, h] of [['390', 390, 844], ['1440', 1440, 900]]) {
  for (const theme of ['light', 'dark']) {
    for (const ledger of [true, false]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'cs-CZ' });
      const perms = ['billing.manage', 'billing.approve', 'billing.refund', 'payments.view', 'patients.view', 'bookings.create'];
      await ctx.addInitScript(([t, p]) => {
        localStorage.setItem('token', 'zz-test');
        localStorage.setItem('user', JSON.stringify({ id: 'u', email: 'zz@test.cz', firstName: 'ZZ', lastName: 'test', role: 'Owner' }));
        localStorage.setItem('permissions', JSON.stringify(p));
      }, [theme, perms]);
      await ctx.addInitScript((t) => { try { localStorage.setItem('sm-theme-mode-v2', t); } catch { /* */ } }, theme);
      const page = await ctx.newPage();
      page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/v1/') && !r.url().includes('/hubs')) console.log('http', r.status(), r.url().slice(-80)); });
      page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('negotiation') && !m.text().includes('Failed to load')) console.log('console:', m.text().slice(0, 160).split(String.fromCharCode(10))[0]); });
      page.on('pageerror', (e) => { failures.push(`${label} ${theme}: pageerror ${e.message}`); console.log('pageerror', e.message.slice(0, 300)); });
      await ctx.route((u) => u.pathname.startsWith('/api/'), (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
      await ctx.route('**/api/v1/account', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: 'u', email: 'zz@test.cz', displayName: 'ZZ test', role: 'Owner', permissions: perms }) }));
      await ctx.route('**/api/billing/invoices', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invoices) }) : r.continue()));
      if (ledger) {
        await ctx.route((u) => u.pathname === '/api/payments', (r) => r.fulfill(ok({ items: payments, total: 3, page: 1, pageSize: 100 })));
        await ctx.route('**/api/payments/reconciliation', (r) => r.fulfill(ok({ generatedAtUtc: now, invoicesChecked: 2, drift: [], needsReviewCount: 1, overduePendingCount: 0 })));
        await ctx.route('**/api/billing/invoices/*/payments', (r) => r.fulfill(ok(payments.filter((p) => p.invoiceId === 'zz-a'))));
        await ctx.route('**/api/billing/invoices/*/payment-qr', (r) => r.fulfill(ok({ paymentId: 'pp1', spayd: 'SPD*1.0*', iban: 'CZ6508000000192000145399', variableSymbol: '20260001', amountCzk: 2200, qrSvg })));
      } else {
        await ctx.route((u) => u.pathname === '/api/payments', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
        await ctx.route('**/api/billing/invoices/*/payments', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
      }
      await page.goto(`${BASE}/billing`);
      await page.getByText('ZZ-0001').first().waitFor({ timeout: 30000 }).catch(async (e) => {
        await page.screenshot({ path: `${OUT}/pay-debug.jpg`, type: 'jpeg', quality: 50 });
        console.log(page.url(), (await page.locator('body').innerText()).slice(0, 300));
        throw e;
      });
      const tag = `${label}-${theme}-${ledger ? 'ledger' : 'noledger'}`;
      const shot = (n) => page.screenshot({ path: `${OUT}/pay-${tag}-${n}.jpg`, type: 'jpeg', quality: 55 });
      const tabs = await page.getByRole('group', { name: 'Doklady nebo platby' }).count();
      if (tabs !== (ledger ? 1 : 0)) failures.push(`${tag}: tabs=${tabs}`);
      const docOverflow = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1 || document.documentElement.scrollWidth > window.innerWidth + 1);
      if (docOverflow) failures.push(`${tag}: the document scrolls`);
      await shot('doklady');
      if (ledger) {
        await page.getByRole('button', { name: 'Platby', exact: true }).click();
        await page.getByText('Čeká na platbu').first().waitFor();
        await shot('platby');
        await page.getByRole('button', { name: 'Doklady', exact: true }).click();
        await page.getByText('ZZ-0001').first().waitFor();
      }
      await page.getByLabel('Přijmout platbu ZZ-0001').first().click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      if (ledger) {
        await dialog.getByRole('combobox', { name: 'Způsob platby' }).click();
        await page.getByRole('option', { name: 'Převodem' }).click();
        await dialog.getByRole('button', { name: 'Zobrazit QR platbu' }).click();
        await dialog.getByTestId('payment-qr').waitFor();
      }
      await page.waitForTimeout(600);
      await shot('dialog');
      if (w < 1280) {
        const small = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button, [role=dialog] input, [role=dialog] [role=combobox]')]
          .filter((e) => e.getAttribute('aria-hidden') !== 'true' && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 43).map((e) => e.tagName + ':' + (e.getAttribute('aria-label') ?? e.textContent ?? '').slice(0, 20) + ':' + Math.round(e.getBoundingClientRect().height)));
        if (small.length) failures.push(`${tag}: small targets in dialog ${JSON.stringify(small)}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log(failures.length ? `FAIL\n${failures.join('\n')}` : 'OK');
process.exit(failures.length ? 1 : 0);
