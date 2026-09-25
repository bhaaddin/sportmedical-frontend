/*
 * /dokonceni/:token -- the patient finishing a desk-started registration.
 *
 * The token IS the identity, like the manage page: no account, no login. The
 * page asks the server what the link pre-fills and then renders the ordinary
 * public registration with those four facts in place. An unknown, used or
 * expired token gets one calm page saying so; the server does not tell them
 * apart and neither does this.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import { openCompletion } from '../../api/publicIntake';
import type { CompletionPrefill } from '../../api/publicIntake';
import IntakeQuestionnaire from './IntakeQuestionnaire';

type Loaded =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'unreachable' }
  | { kind: 'ready'; prefill: CompletionPrefill };

export default function CompleteRegistration() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<Loaded>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (token === undefined || token === '') {
      setState({ kind: 'invalid' });
      return undefined;
    }

    let abandoned = false;
    setState({ kind: 'loading' });

    openCompletion(token)
      .then((prefill) => {
        if (abandoned) return;
        setState(prefill === null ? { kind: 'invalid' } : { kind: 'ready', prefill });
      })
      .catch(() => { if (!abandoned) setState({ kind: 'unreachable' }); });

    return () => { abandoned = true; };
  }, [token, attempt]);

  if (state.kind === 'ready' && token !== undefined) {
    return <IntakeQuestionnaire completion={{ token, prefill: state.prefill }} />;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F6F5F2' }}>
      <Container maxWidth="sm" sx={{ py: 8 }}>
        {state.kind === 'loading' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="Načítám" />
          </Box>
        )}

        {state.kind === 'invalid' && (
          <Alert severity="warning" sx={{ borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Tento odkaz už neplatí</Typography>
            <Typography variant="body2">
              Buď vypršel, nebo už byl použit. Ozvěte se prosím recepci — pošle vám nový odkaz,
              nebo registraci dokončíte na místě.
            </Typography>
          </Alert>
        )}

        {state.kind === 'unreachable' && (
          <Alert
            severity="error"
            sx={{ borderRadius: 3 }}
            action={
              <Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>
                Zkusit znovu
              </Button>
            }
          >
            Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.
          </Alert>
        )}
      </Container>
    </Box>
  );
}
