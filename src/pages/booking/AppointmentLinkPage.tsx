import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { calendarsApi } from "../../api/calendars";
import { AppointmentDetail } from "../../components/booking/AppointmentDetail";

/**
 * The destination a notification points at.
 *
 * `NotificationCenter` navigates to whatever `actionUrl` the backend put on the
 * row, and for booking notifications that is
 * `/kalendar/{calendarId}/termin/{appointmentId}`. No such route existed, so
 * the bell rang, a reception clicked it, and landed nowhere - the same shape as
 * the two dead links on the login screen, except this one is reached by someone
 * responding to a change somebody else just made.
 *
 * Found the day the bell first worked end to end: the row arrived, the header
 * showed it, the panel rendered it, and the click went into a wall.
 *
 * Rather than rewrite the server's link or translate it on the client into
 * something else, the route it already names now exists. One place decides
 * where an appointment lives, and it is the address in the notification.
 *
 * The calendar name and colour are looked up for the header; if that lookup
 * fails the detail still opens, because the appointment is the point and the
 * colour is decoration. Closing goes to the planning grid rather than back -
 * the notification panel is not a page to return to.
 */
export default function AppointmentLinkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { calendarId, appointmentId } = useParams();

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  if (calendarId === undefined || appointmentId === undefined) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", p: 3 }}>
        <Alert severity="warning">{t("booking.appointmentLink.missing")}</Alert>
      </Box>
    );
  }

  const calendar = (calendarsQuery.data ?? []).find((c) => c.id === calendarId);

  return (
    <AppointmentDetail
      appointmentId={appointmentId}
      calendarId={calendarId}
      calendar={calendar}
      open
      onClose={() => navigate("/planovani")}
      onChanged={() => {
        /* Nothing on this page reads the appointment twice - the dialog holds
           the only copy and refetches itself. */
      }}
    />
  );
}
