import { z } from 'zod';
import client from '../../api/client';

/*
 * GET  /api/v1/settings/email/status  - which sender, configured or not, the outbox counters.
 * POST /api/v1/settings/email/test    - one fixed message to one address.
 *
 * The server never sends the API key, so there is nothing here to hide: the
 * schema simply has no field for it.
 */
const statusSchema = z.object({
  provider: z.string(),
  configured: z.boolean(),
  fromAddress: z.string().nullable().optional(),
  lastSuccessUtc: z.string().nullable().optional(),
  sentLast24Hours: z.number(),
  failedLast24Hours: z.number(),
  pending: z.number(),
});

const testSchema = z.object({ sent: z.boolean(), provider: z.string() });

export type EmailStatus = z.infer<typeof statusSchema>;
export type EmailTestOutcome = z.infer<typeof testSchema>;

/** What went wrong, reduced to what the screen words: a stable server code, or a transport reason. */
export interface EmailProblem {
  code: string;
  status: number | undefined;
}

export function problemOf(error: unknown): EmailProblem {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (response === undefined) return { code: 'offline', status: undefined };
  const data = response.data;
  const code = data !== null && typeof data === 'object' ? (data as { code?: unknown }).code : undefined;
  return { code: typeof code === 'string' ? code : 'unknown', status: response.status };
}

export const emailStatusApi = {
  status: async (): Promise<EmailStatus> => {
    const res = await client.get('/api/v1/settings/email/status');
    return statusSchema.parse(res.data);
  },
  sendTest: async (to: string): Promise<EmailTestOutcome> => {
    const res = await client.post('/api/v1/settings/email/test', { to });
    return testSchema.parse(res.data);
  },
};
