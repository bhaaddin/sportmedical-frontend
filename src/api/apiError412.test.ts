import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { toBookingError } from './apiError';

describe('412 precondition failed', () => {
  it('is a conflict, not a server error', () => {
    const err = new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 412, statusText: '', headers: {}, config: {} as InternalAxiosRequestConfig, data: {},
    });
    expect(toBookingError(err).kind).toBe('conflict');
  });
});
