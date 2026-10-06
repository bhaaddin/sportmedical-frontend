/*
 * The first thing a parent reads on /klub/:token (order links): who the club is, the
 * service, the činnosti with length and price, WHO PAYS in plain words, the days and
 * hours the club reserved and how it works in three short steps. Every sentence the
 * clinic words is an editable slot (Média a texty → Formuláře → Klubová registrace);
 * the server's `payerText` wins over the default sentence for who pays.
 */
import { Box, Typography } from '@mui/material';
import type { ClubActivity, ClubInfo, ClubInfoWindow } from '../../../api/publicClub';
import type { Device } from '../../../layout/useDevice';
import { ARCHIVO, BRAND, czk } from '../../../components/public/brand';
import { LABEL_COLOR, Panel, PanelTitle, SOFT_TEXT } from '../../../components/public/kit';
import type { CalTexts } from './texts';
import { allowsActivity, normalizeAllowed } from '../../../components/clubs/order/routing';

export const INFO_SLOT_KEYS = [
  'formulare.club-reg.info.title',
  'formulare.club-reg.info.intro',
  'formulare.club-reg.pay.club',
  'formulare.club-reg.pay.person',
  'formulare.club-reg.pay.person.noprice',
  'formulare.club-reg.pay.unknown',
  'formulare.club-reg.steps.title',
  'formulare.club-reg.steps.1',
  'formulare.club-reg.steps.2',
  'formulare.club-reg.steps.3',
] as const;

export type InfoTexts = Record<(typeof INFO_SLOT_KEYS)[number], string>;

/** "9., 13., 15. října; 2., 3. listopadu" for yyyy-MM-dd dates: day numbers, the month name once per month. */
export function reservedDaysText(dates: readonly string[]): string {
  const byMonth = new Map<string, number[]>();
  for (const d of [...new Set(dates)].sort()) byMonth.set(d.slice(0, 7), [...(byMonth.get(d.slice(0, 7)) ?? []), Number(d.slice(8))]);
  return [...byMonth.entries()].map(([month, days]) => {
    const [y, m] = month.split('-').map(Number);
    const name = new Date(y, m - 1, 1).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' }).replace(/^\d+\.\s*/, '');
    return `${days.map((d) => `${d}.`).join(', ')} ${name}`;
  }).join('; ');
}

/** "Pondělí 26. 10." for a yyyy-MM-dd date. */
export function weekdayDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d}. ${m}.`;
}

/** Etapa 10: the days of the windows that allow `activityId` (all of them while no činnost is chosen). */
export const reservedDaysFor = (windows: readonly ClubInfoWindow[], activityId: string): string[] =>
  windows.filter((w) => activityId === '' || allowsActivity(w.activityIds, activityId)).map((w) => w.date);

/**
 * One line per reserved day, with the činnosti it is for when the day is restricted ("Pondělí 26. 10. · Spiroergometrie");
 * null when no day is restricted (the plain sentence is then enough).
 */
export function reservedDayLines(windows: readonly ClubInfoWindow[], activities: readonly ClubActivity[]): string[] | null {
  const all = activities.map((a) => a.activityId);
  const names = (w: ClubInfoWindow): string | null => {
    const allowed = normalizeAllowed(w.activityIds, all);
    return allowed === null ? null : activities.filter((a) => allowed.includes(a.activityId)).map((a) => a.activityName).join(' + ');
  };
  if (all.length < 2 || !windows.some((w) => names(w) !== null)) return null;
  return [...windows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => {
      const only = names(w);
      return only === null ? weekdayDay(w.date) : `${weekdayDay(w.date)} · ${only}`;
    });
}

/** The price a person pays: the one price, else "od <lowest>"; null when no činnost states one. */
export function pricePerPerson(activities: readonly ClubActivity[]): string | null {
  const prices = activities.map((a) => a.unitPriceCzk).filter((p): p is number => typeof p === 'number');
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const text = czk(min);
  return prices.every((p) => p === min) ? text : `od ${text}`;
}

/** Who pays, in the words of the clinic (server text first, then the editable default for the method). */
export function payerSentence(info: ClubInfo, activities: readonly ClubActivity[], t: InfoTexts): string {
  if (info.payerText.trim() !== '') return info.payerText;
  if (info.paymentMethod === 'ClubInvoice') return t['formulare.club-reg.pay.club'];
  if (info.paymentMethod === 'PerPerson') {
    const price = pricePerPerson(activities);
    return price === null ? t['formulare.club-reg.pay.person.noprice'] : t['formulare.club-reg.pay.person'].replace('{price}', price);
  }
  return t['formulare.club-reg.pay.unknown'];
}

export function InfoPanel({
  info, activities, t, device, cal,
}: { info: ClubInfo; activities: readonly ClubActivity[]; t: InfoTexts; device: Device; cal: CalTexts }) {
  const intro = t['formulare.club-reg.info.intro']
    .replace('{club}', info.clubName)
    .replace('{service}', info.serviceName);
  const dayLines = reservedDayLines(info.windows, activities);
  const steps = [t['formulare.club-reg.steps.1'], t['formulare.club-reg.steps.2'], t['formulare.club-reg.steps.3']];

  return (
    <Panel labelledBy="club-info-title" sx={{ gap: 2.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <PanelTitle id="club-info-title">{t['formulare.club-reg.info.title']}</PanelTitle>
        <Typography sx={{ fontSize: 15.5, color: SOFT_TEXT, lineHeight: 1.55 }}>{intro}</Typography>
      </Box>

      {activities.length > 0 && (
        <Box component="ul" aria-label="Činnosti" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {activities.map((a) => {
            const price = czk(a.unitPriceCzk);
            return (
              <Box
                component="li"
                key={a.activityId}
                sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'baseline', justifyContent: 'space-between', p: '12px 14px', bgcolor: BRAND.page, borderRadius: '12px' }}
              >
                <Typography component="span" sx={{ fontWeight: 700, fontSize: 16 }}>{a.activityName}</Typography>
                <Typography component="span" sx={{ fontSize: 15, color: LABEL_COLOR }}>
                  {a.durationMinutes > 0 ? `${a.durationMinutes} min` : ''}{a.durationMinutes > 0 && price !== null ? ' · ' : ''}{price ?? ''}
                </Typography>
                {a.description != null && (
                  <Typography component="span" sx={{ flex: '1 1 100%', fontSize: 14, color: SOFT_TEXT }}>{a.description}</Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Box role="note" aria-label="Kdo platí" sx={{ p: '12px 14px', border: `1px solid ${BRAND.line}`, borderRadius: '12px', fontSize: 15.5, lineHeight: 1.5 }}>
        {payerSentence(info, activities, t)}
      </Box>

      {info.windows.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography data-testid="club-reserved" sx={{ fontSize: 15, fontWeight: 600 }}>
            {dayLines === null
              ? cal['formulare.club-reg.cal.reserved'].replace('{days}', reservedDaysText(info.windows.map((w) => w.date)))
              : cal['formulare.club-reg.cal.reserved'].replace('{days}', '').trim()}
          </Typography>
          {dayLines !== null && (
            <Box component="ul" data-testid="club-reserved-days" sx={{ m: 0, pl: 2.5, fontSize: 15, lineHeight: 1.5 }}>
              {dayLines.map((line) => <li key={line}>{line}</li>)}
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography component="h3" sx={{ m: 0, fontSize: 14, fontWeight: 700 }}>{t['formulare.club-reg.steps.title']}</Typography>
        <Box
          component="ol"
          data-testid="club-steps"
          data-layout={device}
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25, gridTemplateColumns: device === 'phone' ? '1fr' : 'repeat(3, minmax(0, 1fr))' }}
        >
          {steps.map((text, i) => (
            <Box component="li" key={text} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', fontSize: 15, lineHeight: 1.45 }}>
              <Box aria-hidden="true" sx={{ flex: '0 0 28px', height: 28, borderRadius: '50%', bgcolor: BRAND.accent, color: '#1A1206', fontFamily: ARCHIVO, fontWeight: 800, display: 'grid', placeItems: 'center' }}>
                {i + 1}
              </Box>
              <span>{text}</span>
            </Box>
          ))}
        </Box>
      </Box>
    </Panel>
  );
}
