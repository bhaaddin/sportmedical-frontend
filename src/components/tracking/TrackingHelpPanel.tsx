import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TRACKING_EXTRA_HELP, TRACKING_METRICS } from '../../api/tracking';

/**
 * "Co je sledování": every number on the tracking screens in one sentence.
 * The sentences are the ones the tallies show on hover, kept in one place
 * (`TRACKING_METRICS`) so the panel and the tooltip cannot disagree.
 */
export function TrackingHelpPanel() {
  return (
    <Accordion disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 700 }}>Co je sledování a co které číslo znamená</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
          Každé číslo je spočítané ze skutečných termínů, plateb a dotazníků v okamžiku, kdy se ptáte.
          Nic se neodhaduje a nic se nemění samo — kliknutím na číslo otevřete přesně ten seznam, ze kterého vzniklo.
        </Typography>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'max-content 1fr' }, columnGap: 2, rowGap: 0.75 }}>
          {[...TRACKING_METRICS.map((m) => ({ label: m.label, help: m.help })), ...TRACKING_EXTRA_HELP].map((item) => (
            <Box key={item.label} sx={{ display: 'contents' }}>
              <Typography component="dt" sx={{ fontWeight: 700 }}>
                {item.label}
              </Typography>
              <Typography component="dd" sx={{ m: 0 }}>
                {item.help}
              </Typography>
            </Box>
          ))}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
