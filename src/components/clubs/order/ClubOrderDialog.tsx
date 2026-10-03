/* Placeholder — replaced wholesale by its agent (keep the named export and the props). */

import type { ClubOrderView, OrderRange } from '../../../api/clubOrders';

export interface ClubOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Prefill for a new order (from the calendar selection or a club page). */
  initial?: { clubId?: string; serviceId?: string; ranges?: OrderRange[]; calendarIds?: string[] };
  /** Present = edit this order (add/remove players, another činnost, move/extend/add windows). */
  order?: ClubOrderView;
  /** Present = process this Requested order: fill from its request and confirm. */
  processOrder?: ClubOrderView;
  onSaved?: (order: ClubOrderView) => void;
}

export function ClubOrderDialog(_props: ClubOrderDialogProps) {
  return null;
}

export default ClubOrderDialog;
