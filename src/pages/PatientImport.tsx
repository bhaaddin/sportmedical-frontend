import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Bulk patient import — cancelled, and this says so.
 *
 * The screen used to read a CSV, show a preview and post it to
 * `POST /api/patients/import`. The owner decided on 10. 9. 2026 that patients
 * are never created that way: they are created by a phone call or by booking.
 * The `app` lane closed both import endpoints the same day and they answer
 * `410 Gone`.
 *
 * The route stays and the file stays, which is the point. `/patient-import` is
 * reachable - it is in the router, and anybody with the link or a bookmark
 * still lands here. Deleting the screen would have given them a "page not
 * found", which reads as something broken rather than something decided, and a
 * receptionist who was told last month to import a list would conclude the
 * application is wrong rather than that the answer changed.
 *
 * Why it went, in the words of the measurement rather than the decision: this
 * created patients with no address, no insurance and no registration
 * provenance - patients the registry cannot see. Five such rows exist in the
 * gate database today, which is exactly why a registry search finds nobody
 * while the wider search finds everybody. Closing the front door and leaving
 * this open meant the same rows kept arriving through the side.
 */
export default function PatientImport() {
  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
        Hromadný import pacientů
      </Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Tato funkce byla zrušena.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            Import ze souboru CSV už není možný
          </Typography>
          <Typography variant="body2">
            Zakládal pacienty bez adresy, bez pojištění a bez registrace —
            takové pacienty registr nevidí a nedají se pak spolehlivě najít ani
            objednat.
          </Typography>
        </Alert>

        <Typography sx={{ fontWeight: 600, mb: 1 }}>
          Jak pacienta založit místo toho
        </Typography>
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Telefonicky</strong> — založte pacienta v registru a odkaz
            na dokončení údajů mu pošlete.
          </Typography>
          <Typography variant="body2">
            <strong>Přes objednání</strong> — pacienta vyhledáte, a když v
            registru není, založíte ho odtud.
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button
            component={RouterLink}
            to="/patients/register"
            variant="contained"
          >
            Založit pacienta
          </Button>
          <Button component={RouterLink} to="/planovani" variant="outlined">
            Objednat termín
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
