import { describe, expect, it, vi } from 'vitest';
import client from './client';
import { paymentsApi } from './payments';

describe('paymentsApi soft reads', () => {
  it('hides the ledger on 404 and 403 only', async () => {
    const get = vi.spyOn(client, 'get');
    get.mockRejectedValueOnce({ response: { status: 404 } });
    expect(await paymentsApi.list()).toBeNull();
    get.mockRejectedValueOnce({ response: { status: 403 } });
    expect(await paymentsApi.list()).toBeNull();
    get.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(paymentsApi.list()).rejects.toBeTruthy();
    get.mockRejectedValueOnce(new Error('network'));
    await expect(paymentsApi.reconciliation()).rejects.toBeTruthy();
    get.mockRestore();
  });
});
