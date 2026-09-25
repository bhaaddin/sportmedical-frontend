import { useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { REGISTRATION_LINK_QUERY_KEY, preRegistrationApi } from '../../api/preRegistration';
import type { IssuedRegistrationLink } from '../../api/preRegistration';
import { PRE_REGISTRATION_CHIP, useRegistrationLink } from './registrationLink';
import { usePermission } from '../../auth/usePermission';
import { formatPragueDateTime } from '../../utils/time';
import { RegistrationLinkBox } from './RegistrationLinkBox';

const TEXT = {
  pending: (until: string) =>
    `Pacient je předregistrovaný; odkaz k dokončení registrace platí do ${until}.`,
  expired: 'Pacient je předregistrovaný a odkaz k dokončení registrace vypršel. Vygenerujte nový.',
  noLink:
    'Pacient je předregistrovaný (chybí adresa a pojištění) a odkaz k dokončení registrace zatím nemá. ' +
    'Vygenerujte ho, nebo údaje doplňte v kartě sami.',
  completed: (when: string) => `Registrace dokončena přes odkaz ${when}.`,
  issue: 'Vygenerovat odkaz',
  reissue: 'Vygenerovat odkaz znovu',
  reissueHelp: 'Starý odkaz přestane platit. Nový se pošle e-mailem a ukáže se tady ke zkopírování.',
};

/**
 * The state of a patient's completion link and the button to (re)issue it.
 *
 * Nothing is drawn for a patient who needs none — an ordinary registered
 * patient, or one the desk has since registered by hand. A pre-registered
 * patient with no link yet gets the chip and the button, so the promise the
 * booking dialog makes ("lze ho vygenerovat i později z karty pacienta")
 * holds. The button is offered only to somebody who may register patients,
 * because that is what the server asks for.
 */
export function RegistrationLinkPanel({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const mayRegister = usePermission('patients.register');
  const status = useRegistrationLink(patientId);
  const [issued, setIssued] = useState<IssuedRegistrationLink | null>(null);

  const issue = useMutation({
    mutationFn: () => preRegistrationApi.issueLink(patientId),
    onSuccess: (link) => {
      setIssued(link);
      void queryClient.invalidateQueries({ queryKey: REGISTRATION_LINK_QUERY_KEY(patientId) });
    },
  });

  const state = status.data?.state;
  if (state === undefined) return null;
  if (state === 'none' && !status.data?.registrationIncomplete) return null;

  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      {state === 'completed' ? (
        <Alert severity="success">
          {TEXT.completed(status.data?.completedAtUtc ? formatPragueDateTime(status.data.completedAtUtc) : '')}
        </Alert>
      ) : (
        <Alert severity={state === 'expired' ? 'error' : 'warning'} icon={<Chip size="small" color={state === 'expired' ? 'error' : 'warning'} label={PRE_REGISTRATION_CHIP} />}>
          <Typography variant="body2">
            {state === 'expired'
              ? TEXT.expired
              : state === 'none'
                ? TEXT.noLink
                : TEXT.pending(status.data?.expiresAtUtc ? formatPragueDateTime(status.data.expiresAtUtc) : '')}
          </Typography>
          {mayRegister && issued === null ? (
            <Box sx={{ mt: 1 }}>
              <Button size="small" variant="outlined" disabled={issue.isPending} onClick={() => issue.mutate()}>
                {state === 'pending' ? TEXT.reissue : TEXT.issue}
              </Button>
              {state === 'pending' ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {TEXT.reissueHelp}
                </Typography>
              ) : null}
            </Box>
          ) : null}
          {issue.error ? (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {issue.error.message}
            </Typography>
          ) : null}
        </Alert>
      )}
      {issued ? <RegistrationLinkBox link={issued} /> : null}
    </Stack>
  );
}
