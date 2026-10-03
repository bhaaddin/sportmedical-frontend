/*
 * "Komu doklad vystavujete?" - three big buttons, the first thing the new
 * document asks. Osoba is a patient from the register; Skupina a free group or
 * a firm; Tým a club. Skupina and Tým have no patient.
 */
import { Box, ButtonBase, Typography } from '@mui/material';
import type { RecipientType } from '../../api/billing';
import { DESIGN } from '../ui';

const OPTIONS: { type: RecipientType; title: string; caption: string }[] = [
  { type: 'Person', title: 'Osoba', caption: 'Pacient z kartotéky' },
  { type: 'Group', title: 'Skupina', caption: 'Firma nebo volná skupina' },
  { type: 'Team', title: 'Tým (klub)', caption: 'Klub z kartotéky klubů' },
];

export default function RecipientTypeButtons({
  value,
  onChange,
}: {
  value: RecipientType | null;
  onChange: (next: RecipientType) => void;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label="Komu doklad vystavujete"
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}
    >
      {OPTIONS.map((option) => {
        const selected = option.type === value;
        return (
          <ButtonBase
            key={option.type}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.type)}
            sx={{
              minHeight: 72,
              px: 2,
              py: 1.5,
              borderRadius: 3,
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              textAlign: 'left',
              border: '2px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? DESIGN.softPrimary.bg : 'background.paper',
              '&:hover': { bgcolor: selected ? DESIGN.softPrimary.bg : 'action.hover' },
            }}
          >
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: selected ? 'primary.main' : 'text.primary' }}>
              {option.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{option.caption}</Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}
