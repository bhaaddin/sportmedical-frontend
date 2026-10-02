/*
 * "Exportovat" must send a body the API can bind.
 *
 * POST /api/accounting/export takes ExportCommand, whose Format and Type are
 * the Domain enums ExportFormat (CSV = 0, PohodaXml = 1, MoneyS3Xml = 2) and
 * ExportType (Invoices = 0, CreditNotes = 1, Payments = 2, All = 3). The API
 * binds them as numbers. The screen used to post the names ("CSV",
 * "Invoices") behind an `as any`, System.Text.Json refused them, model
 * validation answered 400 and every export from the screen ended in
 * "Export selhal".
 *
 * What would have to break for these to fail: posting the names again,
 * renumbering the constants away from the server's enums, or sending the
 * form's own field names (from/to) instead of dateFrom/dateTo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const post = vi.fn();
const get = vi.fn();
vi.mock('../api/client', () => ({ default: { post, get, delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { exportCommandFrom } = await import('../services/accountingExportApi');
const { default: AccountingExportPage } = await import('./AccountingExportPage');

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: { id: 'e1', recordCount: 3, fileName: 'export.csv' } });
  get.mockReset().mockImplementation((url: string) => {
    if (url.endsWith('/formats')) {
      return Promise.resolve({
        data: [
          { format: 0, name: 'CSV', contentType: 'text/csv' },
          { format: 1, name: 'PohodaXml', contentType: 'application/xml' },
          { format: 2, name: 'MoneyS3Xml', contentType: 'application/xml' },
        ],
      });
    }
    if (url.endsWith('/download')) return Promise.resolve({ data: new Blob(['x']) });
    return Promise.resolve({ data: [] });
  });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
  /* The download link is clicked; jsdom cannot follow it and need not. */
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

describe('exportCommandFrom', () => {
  it('turns every format and type name into the number the API enum has', () => {
    const base = { from: '2026-09-01', to: '2026-09-23' };
    expect(exportCommandFrom({ ...base, format: 'CSV', type: 'Invoices' })).toEqual({
      format: 0, type: 0, dateFrom: '2026-09-01', dateTo: '2026-09-23',
    });
    expect(exportCommandFrom({ ...base, format: 'PohodaXml', type: 'CreditNotes' })).toMatchObject({ format: 1, type: 1 });
    expect(exportCommandFrom({ ...base, format: 'MoneyS3Xml', type: 'Payments' })).toMatchObject({ format: 2, type: 2 });
    expect(exportCommandFrom({ ...base, format: 'CSV', type: 'All' })).toMatchObject({ type: 3 });
  });
});

describe('AccountingExportPage', () => {
  it('posts numbers, not names, when Exportovat is pressed', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AccountingExportPage />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Exportovat' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toMatch(/\/accounting\/export$/);
    expect(body).toEqual({
      format: 0,
      type: 0,
      dateFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(typeof body.format).toBe('number');
    expect(typeof body.type).toBe('number');
  });
});
