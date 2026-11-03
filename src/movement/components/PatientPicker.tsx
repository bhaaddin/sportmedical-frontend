/* Finding a patient by name (never by a number), and the patient's display name for headings. */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { patientsApi } from '../../api/patients';
import { searchAllPatients, type PatientOption } from '../../api/patientLookup';
import { looksLikeIdentifier } from '../../ui/shelf';
import { movementMock } from '../flags';
import { useMoveT } from '../i18n';

/** "Jana Marková" - the name only; in the mock mode a patient the dev API does not know is just "Pacient". */
export function usePatientLabel(patientId: string | undefined): string | null {
  const q = useQuery({
    queryKey: ['movement', 'patient-label', patientId],
    queryFn: async () => {
      try {
        const p = await patientsApi.getById(patientId!);
        return p.fullName ?? ([p.firstName, p.lastName].filter(Boolean).join(' ') || 'Pacient');
      } catch (error) {
        if (movementMock()) return 'Pacient';
        throw error;
      }
    },
    enabled: patientId !== undefined && patientId !== '',
    staleTime: 5 * 60_000,
    retry: false,
  });
  return q.data ?? null;
}

export function PatientPicker({ onPick, autoFocus = false }: { onPick: (p: PatientOption) => void; autoFocus?: boolean }) {
  const { t } = useMoveT();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(id);
  }, [text]);

  /* A query shaped like a birth number would travel in a URL: it is never sent. */
  const sendable = debounced.length >= 2 && !looksLikeIdentifier(debounced);
  const results = useQuery({
    queryKey: ['movement', 'patient-search', debounced],
    queryFn: () => searchAllPatients(debounced),
    enabled: sendable,
    retry: false,
  });

  return (
    <Stack spacing={1}>
      <TextField
        label={t('home.patient.search')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus={autoFocus}
        autoComplete="off"
        slotProps={{ htmlInput: { 'aria-label': t('home.patient.search'), inputMode: 'search' } }}
      />
      {!sendable ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('home.patient.type')}</Typography>
      ) : results.isLoading ? null : (results.data ?? []).length === 0 ? (
        <Typography variant="body2" role="status" sx={{ color: 'text.secondary' }}>{t('home.patient.empty')}</Typography>
      ) : (
        <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('home.patient.title')}>
          {(results.data ?? []).slice(0, 8).map((p) => (
            <Box component="li" key={p.id}>
              <Button
                fullWidth
                onClick={() => onPick(p)}
                sx={{ justifyContent: 'flex-start', minHeight: 44, textTransform: 'none', color: 'text.primary', border: '1px solid', borderColor: 'divider', px: 1.5 }}
              >
                {p.name}{p.dateOfBirth ? ` · ${p.dateOfBirth.slice(0, 4)}` : ''}
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
