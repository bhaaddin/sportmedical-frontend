/* ══════════════════════════════════════════════════════════════
   HODNOCENÍ NÁVŠTĚVY  (route: /hodnoceni/:token)

   The link a patient follows after a completed visit: one rating on a 1–5 scale,
   a few optional words, one submission. No account, no login — the same brand
   the other public pages wear. A dead or already-used link is told apart plainly.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Rating,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CheckCircleOutlined, StarOutlined } from '@mui/icons-material';
import {
  FeedbackAlreadySubmittedError,
  FeedbackLinkDeadError,
  submitFeedback,
} from '../../api/feedback';

/* ── Brand, the same one /objednat and /klub wear ── */
const BRAND = {
  ink: '#0B0B0C',
  accent: '#FF9D00',
  accentDark: '#E08A00',
  page: '#F4F4F6',
  line: '#E5E5E9',
  muted: 'rgba(17, 17, 17, 0.58)',
};

const INTER = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const publicTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.accent, dark: BRAND.accentDark, contrastText: BRAND.ink },
    background: { default: BRAND.page, paper: '#FFFFFF' },
    text: { primary: '#111111', secondary: BRAND.muted },
    divider: BRAND.line,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: INTER,
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
});

const RATING_WORDS: Record<number, string> = {
  1: 'Špatné',
  2: 'Slabé',
  3: 'V pořádku',
  4: 'Dobré',
  5: 'Výborné',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={publicTheme}>
      <Box sx={{ minHeight: '100vh', bgcolor: BRAND.page, py: { xs: 3, sm: 6 } }}>
        <Container maxWidth="sm">{children}</Container>
      </Box>
    </ThemeProvider>
  );
}

export default function FeedbackPage() {
  const { token = '' } = useParams();

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complaint, setComplaint] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'open' | 'thanks' | 'dead' | 'already'>('open');

  const submit = async () => {
    if (rating === null) return;
    setSubmitting(true);
    setComplaint(null);
    try {
      await submitFeedback(token, {
        rating,
        comment: comment.trim() === '' ? undefined : comment.trim(),
      });
      setOutcome('thanks');
    } catch (error) {
      if (error instanceof FeedbackLinkDeadError) setOutcome('dead');
      else if (error instanceof FeedbackAlreadySubmittedError) setOutcome('already');
      else setComplaint(error instanceof Error ? error.message : 'Hodnocení se nepodařilo uložit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome === 'dead') {
    return (
      <Shell>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Tento odkaz už není platný. Pokud chcete něco sdělit, ozvěte se nám prosím přímo.
        </Alert>
      </Shell>
    );
  }

  if (outcome === 'already') {
    return (
      <Shell>
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Toto hodnocení už bylo odesláno. Děkujeme vám.
        </Alert>
      </Shell>
    );
  }

  if (outcome === 'thanks') {
    return (
      <Shell>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center', py: 4 }}>
          <CheckCircleOutlined sx={{ fontSize: 56, color: BRAND.accent }} />
          <Typography variant="h4">Děkujeme</Typography>
          <Typography sx={{ color: BRAND.muted }}>
            Vaše hodnocení nám pomáhá zlepšovat péči.
          </Typography>
        </Stack>
      </Shell>
    );
  }

  return (
    <Shell>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
            <StarOutlined sx={{ color: BRAND.accent }} />
            <Typography variant="overline" sx={{ color: BRAND.muted, letterSpacing: '0.08em' }}>
              Hodnocení návštěvy
            </Typography>
          </Stack>
          <Typography variant="h4">Jak jste byli spokojeni?</Typography>
          <Typography sx={{ color: BRAND.muted, mt: 0.5 }}>
            Zabere to půl minuty. Hodnocení je soukromé — čte ho jen ordinace.
          </Typography>
        </Box>

        <Box
          sx={{
            border: `1px solid ${BRAND.line}`,
            borderRadius: 2,
            p: 3,
            bgcolor: '#FFFFFF',
            textAlign: 'center',
          }}
        >
          <Rating
            name="rating"
            size="large"
            value={rating}
            onChange={(_, value) => setRating(value)}
            sx={{ fontSize: 44, color: BRAND.accent }}
          />
          <Typography sx={{ mt: 1, fontWeight: 700, minHeight: 24 }}>
            {rating !== null ? RATING_WORDS[rating] : ' '}
          </Typography>
        </Box>

        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Chcete nám něco napsat? (nepovinné)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
        />

        {complaint ? (
          <Alert severity="warning" onClose={() => setComplaint(null)} sx={{ borderRadius: 2 }}>
            {complaint}
          </Alert>
        ) : null}

        <Button
          variant="contained"
          size="large"
          disabled={rating === null || submitting}
          onClick={submit}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
        >
          {submitting ? 'Odesílám…' : 'Odeslat hodnocení'}
        </Button>
      </Stack>
    </Shell>
  );
}
