import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/*
 * The audit trail, read by entity.
 *
 * `GET /api/audit/entity/{entity}/{id}` has existed (returning the masked
 * `AuditLogDto[]`), but nothing showed a *patient-scoped* history — staff could
 * see the global log, never "what happened to this one person." This client is
 * the read behind that view. Values come back already scrubbed by the server
 * (`AuditController.Scrub`), so a birth number cannot reach the screen.
 */

const auditEntrySchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  userEmail: z.string().nullable().optional(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  timestamp: z.string(),
  // Server-scrubbed; shape varies by action (string or a field map), so kept loose.
  oldValue: z.unknown().nullable().optional(),
  newValue: z.unknown().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const auditListSchema = z.array(auditEntrySchema);

export type AuditEntry = z.infer<typeof auditEntrySchema>;

/** Entity names the server audits under (`AuditTrail.AuditAllowlist`). */
export const AUDIT_ENTITY = {
  patient: 'Patient',
} as const;

export const auditApi = {
  /** Every recorded change to one entity, newest first as the server returns them. */
  listByEntity: (entity: string, entityId: string): Promise<AuditEntry[]> => {
    const run = async () => {
      const res = await client.get(
        `/api/audit/entity/${encodeURIComponent(entity)}/${encodeURIComponent(entityId)}`,
      );
      return parseResponse(auditListSchema, res.data);
    };
    return run().catch((error) => {
      // Not logged: an audit value could carry patient detail even scrubbed.
      throw toBookingError(error);
    });
  },
};

export default auditApi;
