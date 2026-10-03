/*
 * One card of the Kluby a týmy grid (board screen 16): the club, whether it has
 * a reservation or a block running, who to call, how many athletes it brings and
 * the discount the administrator gave it. The club's colour is the avatar.
 *
 * No hover-only content: everything the card says is on it, and the whole card
 * is one 44px-plus tap target.
 */
import { Box, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { SoftCard, StatusChip } from '../../components/ui';
import type { ChipTone } from '../../components/ui';
import { ClubAvatar } from '../../components/clubs/ClubAvatar';
import { formatDiscount } from './clubOrders';
import type { ClubStatus } from './clubOrders';
import type { ClubRow } from './clubRow';

export const STATUS_CHIP: Record<ClubStatus, { tone: ChipTone; label: string }> = {
  active: { tone: 'green', label: 'Aktivní rezervace' },
  none: { tone: 'grey', label: 'Bez objednávky' },
  done: { tone: 'grey', label: 'Dokončeno' },
};

export const contactLine = (club: { contactPerson?: string | null; contactPhone?: string | null }): string => {
  const parts = [club.contactPerson, club.contactPhone].filter((p) => (p ?? '').trim() !== '');
  return parts.length > 0 ? parts.join(' · ') : 'Bez kontaktu';
};

export function Figure({ value, label }: { value: string; label: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

export function ClubCard({ row, ordersLoading, onOpen }: { row: ClubRow; ordersLoading: boolean; onOpen: () => void }) {
  const chip = STATUS_CHIP[row.status];
  return (
    <SoftCard
      role="listitem"
      sx={{
        p: 2.5,
        cursor: 'pointer',
        minHeight: 44,
        transition: 'border-color 120ms',
        '&:hover, &:focus-visible': { borderColor: 'primary.main', outline: 'none' },
        ...(row.club.isActive ? {} : { opacity: 0.6 }),
      }}
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 0.75 }}>
        <ClubAvatar name={row.club.name} color={row.color} />
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, minWidth: 0, flex: 1 }} noWrap>
          {row.club.name}
        </Typography>
        {ordersLoading && row.status === 'none' ? (
          <Skeleton variant="rounded" width={96} height={22} sx={{ borderRadius: 999 }} />
        ) : (
          <StatusChip tone={chip.tone}>{row.club.isActive ? chip.label : 'Neaktivní'}</StatusChip>
        )}
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
        {contactLine(row.club)}
      </Typography>
      <Divider sx={{ my: 1.75 }} />
      <Stack direction="row" spacing={4}>
        <Figure value={row.headcount === null ? '—' : String(row.headcount)} label="sportovců" />
        <Figure value={formatDiscount(row.percent)} label="sleva" />
      </Stack>
    </SoftCard>
  );
}

export default ClubCard;
