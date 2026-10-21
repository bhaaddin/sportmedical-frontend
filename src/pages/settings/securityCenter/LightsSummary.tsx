import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';
import { toneColors } from '../../../theme';
import { TYPE, focusRing } from '../../../components/settings/settingsStyle';
import { LIGHT_TONE, LightPill } from './parts';
import { SHELF_ORDER, SHELF_TITLE, type LightView, type ShelfId } from './model';
import type { Light } from '../../../api/securityCenter';

/** The dot colour of a light, from the same tones the status pills use, so a red is the same red everywhere. */
const dotColor = (theme: Theme, light: Light): string => toneColors(theme, LIGHT_TONE[light]).fg;

/**
 * The traffic-light summary at the top: four cards, one per shelf. Each is a real button that moves to its shelf;
 * the state is the pill's WORD as well as its colour. A red card breathes only while the motion setting is "plné".
 */
export function LightsSummary({
  views,
  headlines,
  onOpen,
}: {
  views: Record<ShelfId, LightView>;
  headlines: Record<ShelfId, string>;
  onOpen: (id: ShelfId) => void;
}) {
  return (
    <Box
      component="ul"
      aria-label="Souhrn stavu"
      data-testid="lights"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        mb: 2,
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
      }}
    >
      {SHELF_ORDER.map((id) => {
        const view = views[id];
        return (
          <Box component="li" key={id} sx={{ minWidth: 0 }}>
            <ButtonBase
              onClick={() => onOpen(id)}
              aria-label={`${SHELF_TITLE[id]}: ${view.light === 'green' ? 'v pořádku' : view.light === 'amber' ? 'pozor' : view.light === 'red' ? 'problém' : 'neznámé'}. ${headlines[id]}`}
              data-light={view.light}
              data-card={id}
              sx={[
                focusRing,
                (theme: Theme) => ({
                  width: '100%',
                  minHeight: 96,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  gap: 0.75,
                  textAlign: 'left',
                  p: 1.75,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: alpha(dotColor(theme, view.light), 0.55),
                  borderLeft: `5px solid ${dotColor(theme, view.light)}`,
                  bgcolor: alpha(dotColor(theme, view.light), theme.palette.mode === 'dark' ? 0.1 : 0.07),
                  '&:hover': { bgcolor: alpha(dotColor(theme, view.light), theme.palette.mode === 'dark' ? 0.16 : 0.12) },
                  /* Only while the motion setting is "plné": a red card breathes once a few seconds. */
                  'html[data-motion="full"] &[data-light="red"]': { animation: 'sm-light-breathe 3.2s ease-in-out infinite' },
                  '@keyframes sm-light-breathe': { '0%, 100%': { boxShadow: 'none' }, '50%': { boxShadow: `0 0 0 4px ${alpha(dotColor(theme, 'red'), 0.18)}` } },
                }),
              ]}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', flexWrap: 'wrap' }}>
                <Typography sx={[TYPE.itemName, { flex: '1 1 auto', minWidth: 'max-content' }]}>{SHELF_TITLE[id]}</Typography>
                <LightPill light={view.light} size="sm" />
              </Box>
              <Typography sx={{ fontSize: 13, lineHeight: 1.4, color: 'text.secondary', overflowWrap: 'anywhere' }}>{headlines[id]}</Typography>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
