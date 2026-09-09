import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { Link } from "react-router-dom";
import { isAdminRole, currentUserRole } from "../../App";

/**
 * "Můj rozvrh" - what is left of the old worker-availability screen.
 *
 * It was six hundred lines over `/api/booking/event-types` and
 * `/api/booking/availability`: the B-system model where a worker carried their
 * own availability, separate from any calendar. Stage 9 removes both endpoints
 * and the tables under them, which hold no rows.
 *
 * The replacement is not a port of this screen. A worker now belongs to a day
 * of a calendar's working hours (`workerUserId` on the row, contract 4.2), so
 * "who works when" is set where the working hours are set, and there is nothing
 * left here to keep in sync.
 *
 * This page stays as a signpost rather than being deleted outright: the sidebar
 * entry and any bookmark still lead somewhere that explains itself, instead of
 * a 404 or a screen that fails on every load. A worker's own read-only view of
 * their week does not exist yet and is not silently implied here.
 */
export default function WorkerScheduleSettings() {
  const isAdmin = isAdminRole(currentUserRole());

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <ScheduleIcon color="primary" />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Můj rozvrh
        </Typography>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Rozvrh pracovníka se už nenastavuje zvlášť. Kdo kdy pracuje, se nastavuje
        u pracovní doby kalendáře — na každý den se přiřazuje pracovník, takže
        rozvrh a otevírací doba jsou na jednom místě a nemohou se rozejít.
      </Alert>

      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Vlastní přehled „můj týden“ pro jednotlivého pracovníka zatím není
        hotový. Až bude, objeví se tady.
      </Typography>

      {isAdmin ? (
        <Button component={Link} to="/working-hours" variant="contained">
          Otevřít pracovní dobu
        </Button>
      ) : (
        <Typography sx={{ color: "text.secondary" }}>
          Nastavení pracovní doby má na starosti správce ordinace.
        </Typography>
      )}
    </Box>
  );
}
