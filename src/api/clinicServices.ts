import { z } from 'zod';
import client from './client';
import { toNamedError } from './duplicateName';
import { toInUseError } from './deleteInUse';
import { parseResponse } from './bookingContracts';

/*
 * Služby - what the clinic does, with činnosti underneath.
 *
 * The owner's own words for the shape: "kategória je moja služba... má byť
 * Sportovní lékařská prohlídka, jej činnosti základní komplexní spiroergo".
 *
 *     SLUŽBA      Sportovní lékařské prohlídky · Sportovní diagnostika
 *       ČINNOST     belongs to exactly one
 *     KALENDÁŘ    runs one service
 *
 * This replaces a chain that ran through the price list. A required document
 * used to hang off a price-list category - and those categories turned out to
 * be seed data nobody had written. It hangs off a service now, which is
 * something somebody at the clinic actually created, and every činnost under
 * it inherits the requirement.
 *
 * NOT `/api/services`, which is the price list and stays exactly where it is.
 * On screen: "služba" here, "položka ceníku" there.
 */

export const clinicServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish().transform((v) => v ?? ''),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  /*
   * Counts, not lists. A service with no činnosti offers nothing at all, and
   * that is worth seeing in the list rather than discovering on an empty day.
   */
  activities: z.number().int(),
  calendars: z.number().int(),
  /* Etapa 2, C1: the služba's colour (#RRGGBB), auto-assigned from the palette on create. */
  colorHex: z.string().nullish().transform((v) => v ?? null),
});
export type ClinicService = z.infer<typeof clinicServiceSchema>;
export const clinicServiceListSchema = z.array(clinicServiceSchema);

export interface ClinicServiceInput {
  name: string;
  description: string;
  sortOrder: number;
  /** Etapa 2, C1: left out on create, the server picks the next colour of the palette. */
  colorHex?: string;
}

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    // Deliberately not logged: a response body may carry personal data (6.7).
    throw toNamedError(error);
  }
}

export const clinicServicesApi = {
  list: (): Promise<ClinicService[]> =>
    request(async () => {
      const res = await client.get('/api/clinic-services');
      return parseResponse(clinicServiceListSchema, res.data);
    }),

  create: (input: ClinicServiceInput): Promise<ClinicService> =>
    request(async () => {
      const res = await client.post('/api/clinic-services', input);
      return parseResponse(clinicServiceSchema, res.data);
    }),

  /** The whole entity, as every `PUT` in this lane is (3.1). */
  update: (id: string, input: ClinicServiceInput): Promise<ClinicService> =>
    request(async () => {
      const res = await client.put(`/api/clinic-services/${id}`, input);
      return parseResponse(clinicServiceSchema, res.data);
    }),

  /*
   * Etapa 4, D9: this ARCHIVES (`isActive=false`). Appointments, blocks and orders
   * that reference the služba stay exactly as they are; it only stops being
   * offered for new orders. Never a hard delete, never refused for references.
   */
  remove: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/clinic-services/${id}`);
    }),

  /**
   * Physically removes the služba, only when nothing references it; otherwise
   * rejects with an `InUseError` (409 `service.in_use`) and changes nothing.
   */
  removePermanently: (id: string): Promise<void> =>
    request(async () => {
      try {
        await client.delete(`/api/clinic-services/${id}`, { params: { permanent: true } });
      } catch (error) {
        throw toInUseError(error) ?? error;
      }
    }),

  /** Stops it being offered. What already hangs off it stays where it is. */
  deactivate: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/clinic-services/${id}/deactivate`);
    }),

  activate: (id: string): Promise<void> =>
    request(async () => {
      await client.post(`/api/clinic-services/${id}/activate`);
    }),
};
