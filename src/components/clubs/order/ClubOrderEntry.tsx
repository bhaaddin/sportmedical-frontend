/*
 * "Nová klubová objednávka": exactly two ways in, nothing else.
 *
 *   A  Vyplním sám (telefonická objednávka)  - the club phones; the desk picks the terms straight in the calendar.
 *   B  Poslat odkaz klubu                    - the club fills the order itself; the desk copies the link.
 *
 * Opened from the calendar's "chytrá zkratka", from Kluby -> Objednávky and from a club's card. A is handed to
 * `onPhone` (the calendar starts its picking mode; elsewhere the caller navigates to the calendar); B opens the
 * existing invitation dialog, which creates the Invited order and shows the short link with "Zkopírovat".
 */
import { useState } from 'react';
import { Box, ButtonBase, Dialog, DialogContent, DialogTitle, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { Close, LinkOutlined, PhoneInTalkOutlined } from '@mui/icons-material';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { InviteClubDialog } from '../orders/InviteClubDialog';

const TEXT = {
  title: 'Nová klubová objednávka',
  phone: 'Vyplním sám (telefonická objednávka)',
  phoneHint: 'Klub volá nebo píše. Zadám počty hráčů a vyberu termíny rovnou v kalendáři.',
  link: 'Poslat odkaz klubu',
  linkHint: 'Klub si objednávku vyplní sám. Dostanete krátký odkaz ke zkopírování.',
  close: 'Zavřít',
};

function Choice({ icon, title, hint, onClick, testId }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void; testId: string }) {
  return (
    <ButtonBase
      onClick={onClick}
      data-testid={testId}
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.5, textAlign: 'left', width: '100%',
        px: 2, py: 1.75, minHeight: 80, borderRadius: 3, border: '1px solid', borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      <Box aria-hidden sx={{ color: 'primary.main', display: 'grid', placeItems: 'center' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{hint}</Typography>
      </Box>
    </ButtonBase>
  );
}

export function ClubOrderEntry({ open, onClose, onPhone, defaultClubId, onInvited }: {
  open: boolean;
  onClose: () => void;
  /** Choice A. The caller decides how picking starts (the calendar starts it in place). */
  onPhone: (clubId?: string) => void;
  defaultClubId?: string;
  onInvited?: (order: ClubOrderView) => void;
}) {
  const device = useDevice();
  const [inviting, setInviting] = useState(false);

  if (inviting) {
    return (
      <InviteClubDialog
        open
        defaultClubId={defaultClubId}
        onClose={() => {
          setInviting(false);
          onClose();
        }}
        onInvited={onInvited}
      />
    );
  }
  if (!open) return null;

  const body = (
    <Stack spacing={1.5} data-testid="club-order-entry">
      <Choice
        testId="entry-phone"
        icon={<PhoneInTalkOutlined />}
        title={TEXT.phone}
        hint={TEXT.phoneHint}
        onClick={() => {
          onClose();
          onPhone(defaultClubId);
        }}
      />
      <Choice testId="entry-link" icon={<LinkOutlined />} title={TEXT.link} hint={TEXT.linkHint} onClick={() => setInviting(true)} />
    </Stack>
  );

  if (device === 'phone') {
    return (
      <Drawer
        anchor="bottom"
        open
        onClose={onClose}
        slotProps={{ paper: { role: 'dialog', 'aria-label': TEXT.title, 'data-layout': 'bottom-sheet', sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } } as object }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', px: 2, pt: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>{TEXT.title}</Typography>
          <IconButton aria-label={TEXT.close} onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}><Close /></IconButton>
        </Stack>
        <Box sx={{ px: 2, pb: 3, pt: 1 }}>{body}</Box>
      </Drawer>
    );
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="club-order-entry-title">
      <DialogTitle id="club-order-entry-title" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>{TEXT.title}</Box>
        <IconButton aria-label={TEXT.close} onClick={onClose} edge="end"><Close /></IconButton>
      </DialogTitle>
      <DialogContent>{body}</DialogContent>
    </Dialog>
  );
}

export default ClubOrderEntry;
