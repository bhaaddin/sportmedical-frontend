import client from './client';
import { toBookingError } from './apiError';
import {
  activityListResultSchema,
  activitySaveResultSchema,
  parseResponse,
  type ActivityInput,
  type ActivityListResult,
  type ActivitySaveResult,
} from './bookingContracts';

/** Activities - booking contract 4.3, screen 5.6. An activity has no break of its own. */

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

export const activitiesApi = {
  /** 4.3: the read is symmetric with the write, warnings and all. */
  list: (): Promise<ActivityListResult> =>
    request(async () => {
      const res = await client.get('/api/activities');
      return parseResponse(activityListResultSchema, res.data);
    }),

  /**
   * 5.6: the save may report an unsellable remainder. That is a warning, never
   * a blocking error — an empty `warnings` array is the plain success case.
   */
  create: (input: ActivityInput): Promise<ActivitySaveResult> =>
    request(async () => {
      const res = await client.post('/api/activities', input);
      return parseResponse(activitySaveResultSchema, res.data);
    }),

  update: (id: string, input: ActivityInput): Promise<ActivitySaveResult> =>
    request(async () => {
      const res = await client.put(`/api/activities/${id}`, input);
      return parseResponse(activitySaveResultSchema, res.data);
    }),

  /** 4.3: this discards. The row stays in the list with `isActive: false`. */
  remove: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/activities/${id}`);
    }),

  /** ...and this is the way back, which the screen owed the owner. */
  restore: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/activities/${id}/restore`, {});
    }),
};

export default activitiesApi;
