/*
 * Asks the server what the draft costs - after a short pause, so typing a
 * quantity or a percent is one question rather than six. A newer question
 * cancels the older one; an answer to a question nobody is asking any more is
 * never shown.
 */
import { useCallback, useEffect, useState } from 'react';
import { billingApi } from '../../api/billing';
import type { PriceQuote, PriceQuoteRequest } from '../../api/billing';
import { toBookingError } from '../../api/apiError';
import type { QuoteStatus } from './QuotePanel';

export const QUOTE_DEBOUNCE_MS = 350;

export interface QuoteState {
  quote: PriceQuote | null;
  status: QuoteStatus;
  error: string | null;
  retry: () => void;
  /** The last limit the server named, kept while a new question is on its way. */
  manualAllowedPercent: number | null;
}

export function useInvoiceQuote(request: PriceQuoteRequest | null, debounceMs = QUOTE_DEBOUNCE_MS): QuoteState {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [status, setStatus] = useState<QuoteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [allowed, setAllowed] = useState<number | null>(null);

  const key = request === null ? null : JSON.stringify(request);

  useEffect(() => {
    if (key === null) {
      setQuote(null);
      setStatus('idle');
      setError(null);
      return undefined;
    }
    setStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      billingApi.priceQuote(JSON.parse(key) as PriceQuoteRequest, controller.signal)
        .then((answer) => {
          if (controller.signal.aborted) return;
          if (typeof answer.manualAllowedPercent === 'number') setAllowed(answer.manualAllowedPercent);
          setQuote(answer);
          setError(null);
          setStatus('ready');
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setError(toBookingError(err).serverMessage ?? null);
          setStatus('error');
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt, debounceMs]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { quote, status, error, retry, manualAllowedPercent: allowed };
}
