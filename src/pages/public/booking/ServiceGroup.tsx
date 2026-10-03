/* ══════════════════════════════════════════════════════════════
   SERVICE GROUP  (step 1 of /objednat — "Služba")

   One service of the clinic's offer with its činnosti as cards: name, the
   clinic's own note, the price and length the price list gives, and the
   "Objednat" pill. Everything shown is the API's; a činnost without a linked
   price says "cena na dotaz" rather than a made-up number.
   ══════════════════════════════════════════════════════════════ */

import { useMemo } from 'react';
import { Box, Button, Chip, Typography } from '@mui/material';
import { StarOutlineOutlined } from '@mui/icons-material';
import type { BookableActivity, BookableService } from '../../../api/publicBooking';
import { ARCHIVO, BRAND, czk } from '../../../components/public/brand';
import { LABEL_COLOR, ON_ORANGE, ctaSx } from '../../../components/public/kit';

/**
 * Minutes, declined the way Czech declines them: 1 minutu, 2-4 minuty, 5+ minut.
 * The number is the clinic's to choose, so every case is reachable.
 */
export function minuteWord(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes === 1) return '1 minutu';
  if (minutes >= 2 && minutes <= 4) return `${minutes} minuty`;
  return `${minutes} minut`;
}

/** "1 600 Kč · 40 min" — whichever parts the clinic has set. */
export function priceLine(priceCzk: number | null | undefined, durationMinutes: number | null | undefined): string {
  const parts: string[] = [];
  const price = czk(priceCzk);
  if (price !== null) parts.push(price);
  if (typeof durationMinutes === 'number' && durationMinutes > 0) parts.push(`${durationMinutes} min`);
  return parts.length > 0 ? parts.join(' · ') : 'Cena na dotaz';
}

/** The cheapest priced činnost of a service, for "od 1 600 Kč". */
function fromPrice(service: BookableService): string | null {
  const prices = service.activities
    .map((a) => a.priceCzk)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (prices.length === 0) return null;
  return `od ${czk(Math.min(...prices))}`;
}

const isPackage = (name: string): boolean => /balí[čc]/i.test(name);

export default function ServiceGroup({
  service, onChoose,
}: {
  service: BookableService;
  onChoose: (activity: BookableActivity) => void;
}) {
  const from = useMemo(() => fromPrice(service), [service]);
  const pack = isPackage(service.name);

  return (
    <Box component="section" aria-label={service.name} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em' }}>
          {service.name}
        </Typography>
        {pack && (
          <Chip
            size="small"
            icon={<StarOutlineOutlined sx={{ fontSize: '15px !important', color: `${BRAND.accentDark} !important` }} />}
            label="Zvýhodněná cena"
            sx={{ bgcolor: BRAND.accentWash, color: BRAND.accentDark, border: `1px solid ${BRAND.accentEdge}` }}
          />
        )}
        {from !== null && (
          <Typography sx={{ color: LABEL_COLOR, fontWeight: 600, ml: 'auto', fontSize: 14 }}>{from}</Typography>
        )}
      </Box>
      {service.description !== '' && (
        <Typography sx={{ color: '#5C6067', fontSize: 14, maxWidth: 760 }}>{service.description}</Typography>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        {service.activities.map((activity) => (
          <Box
            key={activity.id}
            sx={{
              display: 'flex', flexDirection: 'column', gap: 1, p: '18px 20px', bgcolor: BRAND.paper,
              border: `1px solid ${BRAND.line}`, borderRadius: '16px', minWidth: 0,
            }}
          >
            <Typography component="h3" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 700, fontSize: 17, lineHeight: 1.25 }}>
              {activity.name}
            </Typography>
            {activity.publicNote !== '' && (
              <Typography sx={{ fontSize: 14, color: '#5C6067', flex: 1 }}>{activity.publicNote}</Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 'auto', pt: 0.5, flexWrap: 'wrap' }}>
              <Typography
                sx={{
                  // typeof, not !== null: an older API omits the field, and
                  // undefined must read as "no price", never crash.
                  fontFamily: ARCHIVO,
                  fontWeight: typeof activity.priceCzk === 'number' ? 700 : 500,
                  color: typeof activity.priceCzk === 'number' ? BRAND.text : LABEL_COLOR,
                  fontSize: 15,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {priceLine(activity.priceCzk, activity.durationMinutes)}
              </Typography>
              <Button
                variant="contained"
                onClick={() => onChoose(activity)}
                aria-label={`Objednat: ${activity.name}`}
                sx={{ ...ctaSx(44), fontSize: 15, px: 2.5, color: ON_ORANGE, whiteSpace: 'nowrap' }}
              >
                Objednat
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

