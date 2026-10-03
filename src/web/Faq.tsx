/* The FAQ as an accordion — questions and answers from the admin (GET /api/public/site-content),
   the defaults shared with the booking page until then. Native <details>: keyboard and screen-reader
   friendly, no JavaScript needed, works in the prerendered HTML. For the inner pages (Kontakt, Dokumenty). */

import { Box } from '@mui/material';
import { useFaq } from '../api/siteContent';
import { ChevronDownIcon } from './ui';
import { FONT_HEAD, W } from './tokens';

export function FaqList() {
  const faq = useFaq();
  if (faq.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${W.line}` }}>
      {faq.map((item) => (
        <Box
          key={item.id}
          component="details"
          sx={{ borderBottom: `1px solid ${W.line}`, '&[open] summary svg': { transform: 'rotate(180deg)' } }}
        >
          <Box
            component="summary"
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', minHeight: 56, py: '12px', cursor: 'pointer',
              listStyle: 'none', fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, '&::-webkit-details-marker': { display: 'none' },
              '& svg': { flex: '0 0 auto', transition: 'transform .2s ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } },
            }}
          >
            {item.question}
            <ChevronDownIcon size={16} />
          </Box>
          <Box component="p" sx={{ m: 0, pb: '18px', fontSize: 16, lineHeight: 1.65, color: W.body, maxWidth: '70ch' }}>{item.answer}</Box>
        </Box>
      ))}
    </Box>
  );
}
