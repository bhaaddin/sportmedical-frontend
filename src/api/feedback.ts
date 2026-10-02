/* ══════════════════════════════════════════════════════════════
   Patient feedback after a completed visit (plan section 23).

   Two readers: the patient's own link (anonymous — never the staff client, which
   would bounce a 401 to the staff login) and the private staff review list.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import { client } from './client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

/** The link matched no open invitation. */
export class FeedbackLinkDeadError extends Error {}

/** The invitation was already answered — one link, one answer. */
export class FeedbackAlreadySubmittedError extends Error {}

export interface FeedbackInput {
  rating: number;
  comment?: string;
}

/** The patient's answer through their link. Refusals arrive as typed errors. */
export const submitFeedback = async (token: string, input: FeedbackInput): Promise<void> => {
  try {
    await publicClient.post<ApiResult<{ submitted: boolean }>>(
      `/api/public/feedback/${encodeURIComponent(token)}`,
      input,
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const message =
        (error.response.data as ApiResult<unknown> | undefined)?.message ??
        'Hodnocení se nepodařilo uložit.';
      if (error.response.status === 404) throw new FeedbackLinkDeadError(message);
      if (error.response.status === 409) throw new FeedbackAlreadySubmittedError(message);
      throw new Error(message);
    }
    throw error;
  }
};

/** One answered feedback as the staff review shows it. */
export interface FeedbackEntry {
  id: string;
  appointmentId: string;
  patientId: string;
  rating: number | null;
  comment: string | null;
  invitedAtUtc: string;
  submittedAtUtc: string | null;
}

export const listFeedback = async (): Promise<FeedbackEntry[]> => {
  const { data } = await client.get<FeedbackEntry[]>('/api/v1/feedback');
  return data;
};

export const FEEDBACK_QUERY_KEY = ['feedback'] as const;
