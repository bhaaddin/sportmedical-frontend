import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * The old calendar - moved, and this says where.
 *
 * `/calendar` used to render `pages/Calendar.tsx`, which read and wrote through
 * `/api/scheduling/appointments`. That surface was a second way into the same
 * appointments table, and it kept no double-booking guard: an appointment made
 * there never reached `BookingOccupancy`, which is what free times are computed
 * from. The backend closed it on 10. 9. 2026 and now answers `410 Gone` on
 * create, and `409` on any attempt to change an appointment that belongs to a
 * calendar - both with a sentence explaining where to go instead.
 *
 * Measured before this file was written, not assumed:
 *
 *     POST   /api/scheduling/appointments              -> 410
 *     POST   /api/scheduling/appointments/{id}/cancel  -> 409  (calendar-owned)
 *     GET    /api/scheduling/appointments              -> 200  (still reads)
 *
 * So every write button on the old screen failed while the screen still sat in
 * the sidebar looking usable. The menu entry is gone; the route stays, because
 * people have it bookmarked and a "page not found" reads as something broken
 * rather than something moved.
 */
export default function CalendarMoved() {
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
        Kalendář
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Tento kalendář byl nahrazen.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            Objednávání se přesunulo do Plánování
          </Typography>
          <Typography variant="body2">
            Starý kalendář zakládal termíny mimo kontrolu obsazenosti, takže se
            na jeden čas dali objednat dva lidé. Nové plánování hlídá volné časy
            na serveru a tohle se stát nemůže.
          </Typography>
        </Alert>

        <Typography sx={{ fontWeight: 600, mb: 1 }}>
          Kam místo toho
        </Typography>
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Plánování</strong> — kalendář, objednání termínu, přesun i
            zrušení.
          </Typography>
          <Typography variant="body2">
            <strong>Dnešní přehled</strong> — kdo dnes přijde a co k tomu chybí.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button component={RouterLink} to="/planovani" variant="contained">
            Otevřít Plánování
          </Button>
          <Button component={RouterLink} to="/dnes" variant="outlined">
            Dnešní přehled
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
