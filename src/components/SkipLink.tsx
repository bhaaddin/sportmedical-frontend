/* ══════════════════════════════════════════════════════════════
   SKIP LINK — WCAG 2.2 bypass mechanism (SC 2.4.1)
   Hidden until focused, jumps to main content.
   ══════════════════════════════════════════════════════════════ */
import { Box } from '@mui/material';

export default function SkipLink() {
  return (
    <Box
      component="a"
      href="#main-content"
      sx={{
        position: 'fixed',
        top: -100,
        left: 16,
        zIndex: 9999,
        bgcolor: 'var(--color-primary)',
        color: '#fff',
        px: 3,
        py: 1.5,
        borderRadius: 2,
        fontWeight: 700,
        fontSize: 14,
        textDecoration: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'top 0.15s ease',
        '&:focus': {
          top: 16,
          outline: '3px solid #FFD600',
          outlineOffset: 2,
        },
      }}
    >
      Přeskočit na hlavní obsah
    </Box>
  );
}
