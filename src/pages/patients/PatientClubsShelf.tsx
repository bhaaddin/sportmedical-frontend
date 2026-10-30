/*
 * "Kluby" on the patient card: the clubs this person plays for (active first), each an address to the club's page.
 * Hidden while loading, on an older server (404), on any failure and when the patient is in no club: the card has
 * no empty box to explain.
 */
import { useQuery } from '@tanstack/react-query';
import { Box, Stack, Typography } from '@mui/material';
import { Shelf, EntityChip } from '../../ui/shelf';
import { patientClubsApi, patientClubsKey, type PatientClubMembership } from '../../api/patientClubs';
import { formatDateOnly } from '../../utils/time';

export function membershipLine(m: PatientClubMembership): string {
  const parts: string[] = [];
  if (m.position !== null) parts.push(m.position);
  if (m.memberNumber !== null) parts.push(`č. ${m.memberNumber}`);
  if (m.joinedAt !== null) parts.push(`od ${formatDateOnly(m.joinedAt.slice(0, 10))}`);
  if (!m.isActive) parts.push(m.leftAt !== null ? `do ${formatDateOnly(m.leftAt.slice(0, 10))}` : 'bývalý člen');
  return parts.join(' · ');
}

export default function PatientClubsShelf({ patientId }: { patientId: string }) {
  const clubs = useQuery({
    queryKey: patientClubsKey(patientId),
    queryFn: () => patientClubsApi.byPatient(patientId),
    retry: false,
    staleTime: 60_000,
  });
  const rows = clubs.data ?? [];
  if (rows.length === 0) return null;
  return (
    <Shelf id="clubs" title="Kluby" count={rows.length} layout="free" stagger={false}>
      <Stack spacing={1.25} component="ul" aria-label="Kluby pacienta" sx={{ listStyle: 'none', m: 0, p: 2 }}>
        {rows.map((m) => (
          <Box component="li" key={m.memberId} sx={{ opacity: m.isActive ? 1 : 0.7 }}>
            <EntityChip entity={{ kind: 'club', id: m.clubId, label: m.clubName }} />
            {membershipLine(m) !== '' ? <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{membershipLine(m)}</Typography> : null}
          </Box>
        ))}
      </Stack>
    </Shelf>
  );
}
