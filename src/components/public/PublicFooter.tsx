/* ══════════════════════════════════════════════════════════════
   PUBLIC FOOTER  (artboard V-Web2)

   Address, contact, opening hours, links, the legal line. Phone, e-mail, address
   and hours come from the clinic's own settings (GET /api/public/clinic); a field
   the clinic has not filled in falls back to the text slot `site.footer.*`
   (editable in "Média a texty", default = the clinic's published details).
   `content` is passed by the /web layout (the admin's slot texts); the application's
   public pages pass nothing and get the registry defaults — no react-query needed.
   ══════════════════════════════════════════════════════════════ */

import { Box } from '@mui/material';
import type { PublicClinic } from '../../api/clinicSettings';
import { resolveSlot } from '../../api/siteContent';
import type { SiteContent } from '../../api/siteContent';
import { DEFAULT_SITE_CONTENT } from '../../site/defaults';
import { SiteLink } from '../../web/SiteLink';
import { FONT_HEAD, GUTTER, MAX_WIDTH, MQ, W } from '../../web/tokens';
import { Lines } from '../../site/SlotText';
import { mapsHref, telHref } from './brand';
import { Brand } from './PublicHeader';
import { SITE } from '../../pages/public/content';

const colLabel = { fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: W.onInkMuted } as const;
const linkStyle = {
  display: 'flex', alignItems: 'center', minHeight: { xs: 44, md: 28 }, color: W.onInk, fontSize: 15, textDecoration: 'none',
  '&:hover': { color: W.white, textDecoration: 'underline' },
} as const;

/** Opening hours as lines: the clinic's one-liner is split at " · " and ";" so it reads like the artboard. */
export function hoursLines(hours: string): string[] {
  return hours.split(/\s*(?:\n|·|;)\s*/).map((line) => line.trim()).filter((line) => line !== '');
}

export function PublicFooter({ clinic, content = DEFAULT_SITE_CONTENT }: { clinic: PublicClinic | null; content?: SiteContent }) {
  const slot = (key: string) => resolveSlot(content, key).text;
  const phone = clinic?.phone.trim() || slot('site.footer.phone');
  const email = clinic?.email.trim() || slot('site.footer.email');
  const address = clinic?.address.trim() ?? '';
  const hours = clinic?.openingHours?.trim() ?? '';
  const addressForMaps = address !== '' ? address : slot('site.footer.address').split('\n').join(', ');

  return (
    <Box component="footer" sx={{ bgcolor: W.ink, color: W.onInk, mt: 'auto', px: GUTTER, pt: { xs: '44px', md: '60px' }, pb: { xs: '32px', md: '36px' } }}>
      <Box sx={{ maxWidth: MAX_WIDTH, mx: 'auto' }}>
        <Box
          sx={{
            display: 'grid', gap: { xs: '36px', md: '46px' }, gridTemplateColumns: '1fr',
            [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            [MQ.desktop]: { gridTemplateColumns: '1.3fr 1.1fr 1fr 0.9fr' },
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
            <Brand />
            <Box
              component="a"
              href={mapsHref(addressForMaps)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontSize: 15, lineHeight: 1.7, color: W.onInk, textDecoration: 'none', '&:hover': { color: W.white } }}
            >
              {address !== '' ? address : <Lines text={slot('site.footer.address')} />}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            <Box component="span" sx={colLabel}>Kontakt</Box>
            <Box component="a" href={telHref(phone)} sx={{ color: W.white, fontFamily: FONT_HEAD, fontSize: 21, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', minHeight: 44 }}>
              {phone}
            </Box>
            <Box component="a" href={`mailto:${email}`} sx={{ color: W.white, fontSize: 15, textDecoration: 'none', overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', minHeight: 44 }}>
              {email}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            <Box component="span" sx={colLabel}>Provozní doba</Box>
            <Box component="span" sx={{ fontSize: 15, lineHeight: 1.7 }}>
              {(hours !== '' ? hoursLines(hours) : slot('site.footer.hours').split('\n')).map((line, index) => (
                <Box key={line} component="span" sx={{ display: 'block', ...(index > 0 && hours === '' && line.startsWith('provoz') ? { color: W.onInkMuted } : {}) }}>
                  {line}
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 0, md: '6px' }, minWidth: 0 }}>
            <Box component="span" sx={{ ...colLabel, mb: { xs: '4px', md: '4px' } }}>Odkazy</Box>
            <Box component={SiteLink} to="/web/cenik" sx={linkStyle}>Ceník služeb</Box>
            <Box component={SiteLink} to="/web/kluby" sx={linkStyle}>Pro kluby</Box>
            <Box component={SiteLink} to="/portal/prihlaseni" sx={linkStyle}>Můj portál</Box>
            <Box component={SiteLink} to="/web/dokumenty" sx={linkStyle}>Dokumenty k testům</Box>
            {SITE.policies.map((policy) => (
              <Box key={policy.href} component="a" href={policy.href} target="_blank" rel="noopener noreferrer" sx={linkStyle}>
                Zpracování osobních údajů
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: { xs: '32px', md: '34px' }, pt: '22px', borderTop: `1px solid ${W.inkLine}`, fontSize: 13, color: W.onInkMuted, display: 'flex', flexWrap: 'wrap', gap: '8px 24px', justifyContent: 'space-between' }}>
          <span>{slot('site.footer.legal')}</span>
          <span suppressHydrationWarning>© {new Date().getFullYear()} {SITE.legalName}</span>
        </Box>
      </Box>
    </Box>
  );
}
