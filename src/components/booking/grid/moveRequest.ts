import type { DayAppointment } from "../../../api/bookingContracts";
import type { DateOnly } from "../../../utils/time";

/** An appointment dropped on a new time (the calendar's move, asked about before it is sent). */
export interface GridMoveRequest {
  appointment: DayAppointment;
  calendarId: string;
  dayKey: DateOnly;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. */
  start: string;
  end: string;
  startUtc: string;
  endUtc: string;
  /**
   * "Upozornit klienta na změnu" (Etapa 12): the patient gets a notification and
   * an e-mail about the new time. On by default; the confirm popover's checkbox
   * carries the desk's choice here for the page and the API to pass on.
   */
  notifyPatient: boolean;
}
