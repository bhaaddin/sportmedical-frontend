import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/**
 * Employee absences - `api/employee-absences`, booking batch 2.
 *
 * A stretch of days one member of staff is out: holiday, sick leave, a
 * conference. The server applies it everywhere a day is worked out - public
 * availability, the desk's booking and moving, the grid, the day overview and
 * partner orders - so recording it here is the whole job. Reading and writing
 * both need `settings.clinic.manage`.
 */

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const employeeAbsenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  /** `null` when the account can no longer be named. */
  workerDisplayName: z.string().nullish().transform((v) => v ?? null),
  fromDate: dateOnly,
  /** The last day out, inclusive. */
  toDate: dateOnly,
  reason: z.string().nullish().transform((v) => v ?? ''),
});
export type EmployeeAbsence = z.infer<typeof employeeAbsenceSchema>;

const employeeAbsenceListSchema = z.array(employeeAbsenceSchema);

export interface EmployeeAbsenceInput {
  userId: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
}

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export const employeeAbsencesApi = {
  /** Most recent first. One person's when `userId` is given, everybody's otherwise. */
  list: (userId?: string): Promise<EmployeeAbsence[]> =>
    request(async () => {
      const res = await client.get('/api/employee-absences', {
        params: userId ? { userId } : undefined,
      });
      return parseResponse(employeeAbsenceListSchema, res.data);
    }),

  create: (input: EmployeeAbsenceInput): Promise<EmployeeAbsence> =>
    request(async () => {
      const res = await client.post('/api/employee-absences', input);
      return parseResponse(employeeAbsenceSchema, res.data);
    }),

  remove: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/employee-absences/${id}`);
    }),
};

/**
 * What stops the save before it is sent, in the screen's own words. The server
 * refuses the same things (an end before the start, nobody named); saying so
 * here keeps the form filled in and says which field is wrong.
 */
export function absenceDraftProblem(draft: {
  userId: string;
  fromDate: string;
  toDate: string;
}): 'worker' | 'dates' | 'order' | null {
  if (draft.userId === '') return 'worker';
  if (!dateOnly.safeParse(draft.fromDate).success || !dateOnly.safeParse(draft.toDate).success) {
    return 'dates';
  }
  /* ISO dates compare as strings. */
  return draft.toDate < draft.fromDate ? 'order' : null;
}
