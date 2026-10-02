/* ══════════════════════════════════════════════════════════════
   PUBLIC FOOTER

   Legal name, IČO and registered office from content.ts (they are not in the
   API); telephone, e-mail and address from the clinic's own settings at
   runtime — an empty field is left out, never replaced by a placeholder.
   ══════════════════════════════════════════════════════════════ */

import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Link, Typography } from '@mui/material';
import type { PublicClinic } from '../../api/clinicSettings';
import { BRAND, mapsHref, telHref } from './brand';
import { SITE } from '../../pages/public/content';
import { Brand, LANDING_PATH, LANDING_SECTIONS, PORTAL_SIGN_IN_PATH } from './PublicHeader';

const col = { display: 'grid', gap: 0.9, alignContent: 'start' } as const;
const label = {
  color: BRAND.accent,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  mb: 0.5,
} as const;
const link = {
  color: BRAND.onInk,
  textDecoration: 'none',
  fontSize: 14,
  '&:hover': { color: '#FFFFFF', textDecoration: 'underline' },
} as const;

export function PublicFooter({ clinic }: { clinic: PublicClinic | null }) {
  const phone = clinic?.phone.trim() ?? '';
  const email = clinic?.email.trim() ?? '';
  const address = clinic?.address.trim() ?? '';
  const hours = clinic?.openingHours?.trim() || SITE.hoursFallback;

  return (
    <Box component="footer" sx={{ bgcolor: BRAND.ink, color: '#FFFFFF', mt: 'auto', pt: { xs: 5, md: 7 }, pb: 4 }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 4, md: 5 },
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.4fr 1fr 1fr 1fr' },
          }}
        >
          <Box sx={col}>
            <Brand />
            <Typography sx={{ color: BRAND.onInk, fontSize: 14, maxWidth: 320, mt: 1 }}>
              Sportovní lékařské prohlídky, zátěžová diagnostika a analýza těla pro
              rekreační i vrcholové sportovce.
            </Typography>
            <Typography sx={{ color: BRAND.faint, fontSize: 12.5, mt: 1 }}>
              {SITE.legalName} · IČO {SITE.ico}
              <br />
              Sídlo: {SITE.registeredOffice}
            </Typography>
          </Box>

          <Box sx={col}>
            <Typography sx={label}>Kontakt</Typography>
            {phone !== '' && (
              <Link href={telHref(phone)} sx={link}>{phone}</Link>
            )}
            {email !== '' && (
              <Link href={`mailto:${email}`} sx={{ ...link, overflowWrap: 'anywhere' }}>{email}</Link>
            )}
            {address !== '' && (
              <Link href={mapsHref(address)} target="_blank" rel="noopener noreferrer" sx={link}>
                {address}
              </Link>
            )}
            <Typography sx={{ color: BRAND.onInk, fontSize: 14, mt: 0.5 }}>
              <Box component="span" sx={{ color: BRAND.faint }}>Ordinační hodiny</Box>
              <br />
              {hours}
            </Typography>
          </Box>

          <Box sx={col}>
            <Typography sx={label}>Objednání</Typography>
            {LANDING_SECTIONS.map((section) => (
              <Link
                key={section.anchor}
                component={RouterLink}
                to={`${LANDING_PATH}#${section.anchor}`}
                sx={link}
              >
                {section.label}
              </Link>
            ))}
            <Link component={RouterLink} to={PORTAL_SIGN_IN_PATH} sx={link}>Můj portál</Link>
          </Box>

          <Box sx={col}>
            <Typography sx={label}>Web kliniky</Typography>
            {SITE.websitePages.map((page) => (
              <Link key={page.href} href={page.href} target="_blank" rel="noopener noreferrer" sx={link}>
                {page.label}
              </Link>
            ))}
            {SITE.policies.map((policy) => (
              <Link key={policy.href} href={policy.href} target="_blank" rel="noopener noreferrer" sx={link}>
                {policy.label}
              </Link>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            borderTop: `1px solid ${BRAND.onInkLine}`,
            mt: { xs: 4, md: 6 },
            pt: 2.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            justifyContent: 'space-between',
            color: BRAND.faint,
            fontSize: 12.5,
          }}
        >
          <span>© {new Date().getFullYear()} {SITE.legalName}</span>
          <Link href={SITE.website} target="_blank" rel="noopener noreferrer" sx={{ ...link, fontSize: 12.5 }}>
            {SITE.website.replace(/^https?:\/\//, '')}
          </Link>
        </Box>
      </Container>
    </Box>
  );
}
