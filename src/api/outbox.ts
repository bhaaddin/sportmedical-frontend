import { z } from 'zod';
import client from './client';

/*
 * The e-mail queue (Nastavení > Komunikace > Fronta e-mailů), `/api/system/outbox`, permission settings.clinic.manage.
 * The server already hides birth-number-shaped values in subject, body and error; nothing here adds or removes that.
 * An older server has no route: the screen tells the desk in a calm note (404) instead of failing.
 */
export type OutboxStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

const messageSchema = z.object({
  id: z.string(),
  to: z.string().nullish().transform((v) => v ?? ''),
  subject: z.string().nullish().transform((v) => v ?? ''),
  body: z.string().nullish().transform((v) => v ?? ''),
  status: z.string().transform((v) => v.toLowerCase()),
  statusLabel: z.string().nullish().transform((v) => v ?? ''),
  attempts: z.number().catch(0),
  lastError: z.string().nullish().transform((v) => v ?? null),
  createdAtUtc: z.string().nullish().transform((v) => v ?? null),
  sentAtUtc: z.string().nullish().transform((v) => v ?? null),
  templateCode: z.string().nullish().transform((v) => v ?? null),
});

const listSchema = z.object({
  items: z.array(z.unknown()).catch([]),
  pending: z.number().catch(0),
  senderConfigured: z.boolean().catch(true),
});

export type OutboxMessage = z.infer<typeof messageSchema>;
export interface OutboxList {
  items: OutboxMessage[];
  pending: number;
  senderConfigured: boolean;
}

const readMessage = (raw: unknown): OutboxMessage => messageSchema.parse(raw);

const base = '/api/system/outbox';

export const outboxApi = {
  list: async (status: OutboxStatus | '' = '', take = 100): Promise<OutboxList> => {
    const res = await client.get(base, { params: { take, ...(status !== '' ? { status } : {}) } });
    const parsed = listSchema.parse(res.data ?? {});
    const items = parsed.items.flatMap((raw) => {
      const one = messageSchema.safeParse(raw);
      return one.success ? [one.data] : [];
    });
    return { items, pending: parsed.pending, senderConfigured: parsed.senderConfigured };
  },
  get: async (id: string): Promise<OutboxMessage> => readMessage((await client.get(`${base}/${encodeURIComponent(id)}`)).data),
  retry: async (id: string): Promise<OutboxMessage> => readMessage((await client.post(`${base}/${encodeURIComponent(id)}/retry`)).data),
  cancel: async (id: string): Promise<OutboxMessage> => readMessage((await client.post(`${base}/${encodeURIComponent(id)}/cancel`)).data),
};

/** The HTTP status of a failed call, or undefined when there was no answer. */
export function outboxStatusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

export const OUTBOX_STATUS_LABEL: Record<OutboxStatus, string> = {
  pending: 'čeká',
  sent: 'odesláno',
  failed: 'selhalo',
  cancelled: 'zrušeno',
};

/** Czech reading of a failed retry / cancel. */
export function outboxActionProblem(error: unknown, verb: 'retry' | 'cancel'): string {
  switch (outboxStatusOf(error)) {
    case 404: return 'Tuto zprávu už server nezná. Obnovte seznam.';
    case 409: return verb === 'retry' ? 'Znovu odeslat jde jen zprávu, která selhala.' : 'Tuto zprávu už zrušit nejde (je odeslaná nebo zrušená).';
    case 429: return 'Příliš mnoho pokusů za minutu. Chvíli počkejte.';
    case 403: return 'K frontě e-mailů nemáte oprávnění.';
    default: return 'Akce se nepovedla. Zkuste to znovu.';
  }
}
