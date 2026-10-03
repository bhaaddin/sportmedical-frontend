/* ══════════════════════════════════════════════════════════════
   HODNOCENÍ NÁVŠTĚVY  (route: /hodnoceni/:token)

   The link a patient follows after a completed visit: one rating on a 1–5 scale,
   a few optional words, one submission. No account, no login — the same frame
   the other public pages wear (PublicLayout, artboard family V-Web2). A dead or
   already-used link is told apart plainly. Phone: "Odeslat hodnocení" is pinned
   at the bottom of the screen.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, CircularProgress, Button, Rating, TextField, Typography } from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';
import {
  FeedbackAlreadySubmittedError,
  FeedbackLinkDeadError,
  submitFeedback,
} from '../../api/feedback';
import PublicLayout from './PublicLayout';
import { ARCHIVO, BRAND } from '../../components/public/brand';
import { LABEL_COLOR, PageTitle, Panel, PinnedBar, PublicMain, ctaSx } from '../../components/public/kit';

const RATING_WORDS: Record<number, string> = {
  1: 'Špatné',
  2: 'Slabé',
  3: 'V pořádku',
  4: 'Dobré',
  5: 'Výborné',
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <PublicLayout>
      <PublicMain maxWidth={640} gap={2.5}>{children}</PublicMain>
    </PublicLayout>
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
        <Panel component="div" sx={{ alignItems: 'center', textAlign: 'center', py: 5 }}>
          <CheckCircleOutlined sx={{ fontSize: 56, color: BRAND.accent }} aria-hidden />
          <Typography component="h1" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em' }}>
            Děkujeme
          </Typography>
          <Typography sx={{ color: LABEL_COLOR }}>
            Vaše hodnocení nám pomáhá zlepšovat péči.
          </Typography>
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageTitle sub="Zabere to půl minuty. Hodnocení je soukromé — čte ho jen ordinace.">
        Jak jste byli spokojeni?
      </PageTitle>

      <Panel component="div">
        <Box
          sx={{
            border: `1px solid ${BRAND.accentEdge}`,
            borderRadius: '12px',
            p: 3,
            bgcolor: BRAND.accentWash,
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
      </Panel>

      <PinnedBar label="Odeslat hodnocení">
        <Button
          variant="contained"
          disabled={rating === null || submitting}
          onClick={submit}
          startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
          sx={ctaSx(50)}
        >
          {submitting ? 'Odesílám…' : 'Odeslat hodnocení'}
        </Button>
      </PinnedBar>
    </Shell>
  );
}
