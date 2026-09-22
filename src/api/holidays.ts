import { client } from './client';

/**
 * One day in the clinic's year.
 *
 * `isHoliday` is what actually happens — the law as the clinic has amended it.
 * The other two flags are why: whether the law gives the day, and whether the
 * clinic has overruled it. A screen that shows only the first cannot explain
 * itself, which is how the statutory list came to be invisible in the first
 * place.
 */
export interface ClinicHoliday {
  date: string;
  name: string;
  isHoliday: boolean;
  isStatutory: boolean;
  isAmended: boolean;
}

interface ApiResult<T> {
  success: boolean;
  message: string;
  data: T;
}

export const holidaysApi = {
  /** Every day off in one year, statutory and amended, merged into one list. */
  year: async (year: number): Promise<ClinicHoliday[]> => {
    const { data } = await client.get<ClinicHoliday[]>(`/api/holidays/${year}`);

    return data ?? [];
  },

  /**
   * Marks a date as a holiday, or as a day the clinic works.
   *
   * The name is required in both directions: "Firemní volno" and "Pracujeme"
   * are both worth reading next to a date, and a row with nothing beside it
   * sends somebody to the source to find out why a Tuesday in June is shut.
   */
  save: async (date: string, isHoliday: boolean, name: string): Promise<ClinicHoliday> => {
    const { data } = await client.put<ClinicHoliday>(`/api/holidays/${date}`, {
      isHoliday,
      name,
    });

    return data;
  },

  /** Drops the amendment, putting the date back on the statutory calendar. */
  reset: async (date: string): Promise<void> => {
    await client.delete(`/api/holidays/${date}`);
  },
};
