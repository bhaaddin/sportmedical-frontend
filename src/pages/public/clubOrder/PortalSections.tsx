/*
 * The panels of the club portal (Etapa 11): the chosen day with its windows and players, the progress per činnost,
 * "Změny od ordinace" and the clinic's contact. All wording comes in as `t` (editable slots in formulare.ts); the
 * lists are the server's. Cancelled players are struck through and labelled, in a calm grey - never red.
 */
import { Box, Typography } from '@mui/material';
import type { ClubPortal, PortalAthlete } from '../../../api/publicClubOrder';
import { ARCHIVO, BRAND, clinicDate } from '../../../components/public/brand';
import { FieldLabel, LABEL_COLOR, Panel, PanelTitle, SOFT_TEXT, longWhen } from '../../../components/public/kit';
import { czk } from './model';
import { activityNames, isFresh, percentOf, playersOfDay, timeRange } from './portalModel';

export const PORTAL_SLOT_KEYS = [
  'formulare.club-order.portal.reference',
  'formulare.club-order.portal.chip.requested',
  'formulare.club-order.portal.chip.confirmed',
  'formulare.club-order.portal.chip.completed',
  'formulare.club-order.portal.chip.cancelled',
  'formulare.club-order.portal.status.requested',
  'formulare.club-order.portal.status.confirmed',
  'formulare.club-order.portal.status.completed',
  'formulare.club-order.portal.status.cancelled',
  'formulare.club-order.portal.cal.title',
  'formulare.club-order.portal.cal.hint',
  'formulare.club-order.portal.cal.empty',
  'formulare.club-order.portal.cal.pick',
  'formulare.club-order.portal.cal.gone',
  'formulare.club-order.portal.cal.noplayers',
  'formulare.club-order.portal.cal.allactivities',
  'formulare.club-order.portal.cal.cancelled',
  'formulare.club-order.portal.progress.title',
  'formulare.club-order.portal.progress.line',
  'formulare.club-order.portal.price.title',
  'formulare.club-order.portal.price.perplayer',
  'formulare.club-order.portal.price.none',
  'formulare.club-order.portal.price.list',
  'formulare.club-order.portal.price.total',
  'formulare.club-order.portal.price.group',
  'formulare.club-order.portal.price.unpriced',
  'formulare.club-order.portal.price.club',
  'formulare.club-order.portal.price.toinvoice',
  'formulare.club-order.portal.price.invoiced',
  'formulare.club-order.portal.price.person',
  'formulare.club-order.portal.notices.title',
  'formulare.club-order.portal.notices.empty',
  'formulare.club-order.portal.notices.new',
  'formulare.club-order.portal.contact.title',
  'formulare.club-order.portal.contact.text',
  'formulare.club-order.portal.cancelled.title',
  'formulare.club-order.portal.cancelled.text',
  'formulare.club-order.portal.stale',
  'formulare.club-order.link.title',
  'formulare.club-order.link.text',
  'formulare.club-order.link.copy',
  'formulare.club-order.link.copied',
] as const;

export type PortalTexts = Record<(typeof PORTAL_SLOT_KEYS)[number], string>;

const hhmm = (time: string): string => time.slice(0, 5);

function PlayerRow({ athlete, label }: { athlete: PortalAthlete; label: string }) {
  const cancelled = athlete.status === 'Cancelled';
  return (
    <Box
      component="li"
      data-testid="portal-player"
      data-status={athlete.status}
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 10px', fontSize: 15, color: cancelled ? LABEL_COLOR : BRAND.text }}
    >
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, textDecoration: cancelled ? 'line-through' : 'none' }}>{hhmm(athlete.startLocal)}</Box>
      <Box component="span" sx={{ textDecoration: cancelled ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{athlete.name}</Box>
      {athlete.activityName !== '' && (
        <Box component="span" sx={{ color: LABEL_COLOR, textDecoration: cancelled ? 'line-through' : 'none' }}>{athlete.activityName}</Box>
      )}
      {cancelled && (
        <Box component="span" sx={{ fontSize: 12, fontWeight: 700, px: '8px', py: '1px', borderRadius: '10px', bgcolor: '#EFECE6', color: LABEL_COLOR }}>{label}</Box>
      )}
    </Box>
  );
}

/** What the chosen day holds: each window with its hours and činnosti, the players booked in it under it. */
export function PortalDay({ portal, day, t }: { portal: ClubPortal; day: string | null; t: PortalTexts }) {
  if (day === null) {
    return <Typography role="status" sx={{ fontSize: 15, color: LABEL_COLOR }}>{t['formulare.club-order.portal.cal.pick']}</Typography>;
  }
  const { perWindow, loose } = playersOfDay(day, portal.windows, portal.athletes);
  if (perWindow.length === 0) {
    return <Typography role="status" sx={{ fontSize: 15, color: LABEL_COLOR }}>{t['formulare.club-order.portal.cal.gone']}</Typography>;
  }
  const cancelledLabel = t['formulare.club-order.portal.cal.cancelled'];
  const none = t['formulare.club-order.portal.cal.noplayers'];
  const all = t['formulare.club-order.portal.cal.allactivities'];
  return (
    <Box role="group" aria-label={clinicDate(day)} data-testid="portal-day-detail" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <Typography component="h3" sx={{ m: 0, fontSize: 15, fontWeight: 700 }}>{clinicDate(day).replace(/^./, (c) => c.toUpperCase())}</Typography>
      {perWindow.map(({ window, athletes }, i) => (
        <Box key={`${window.startLocal}-${i}`} data-testid="portal-window" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: '12px 14px', borderRadius: '12px', border: `1px solid ${BRAND.line}`, bgcolor: BRAND.page }}>
          <Typography data-testid="portal-window-title" sx={{ fontSize: 16, fontWeight: 700 }}>
            {`${timeRange(window)} · ${activityNames(window, portal.activities, all)}`}
          </Typography>
          {athletes.length === 0 ? (
            <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{none}</Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {athletes.map((a, k) => <PlayerRow key={`${a.name}-${a.startLocal}-${k}`} athlete={a} label={cancelledLabel} />)}
            </Box>
          )}
        </Box>
      ))}
      {loose.length > 0 && (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {loose.map((a, k) => <PlayerRow key={`${a.name}-${a.startLocal}-${k}`} athlete={a} label={cancelledLabel} />)}
        </Box>
      )}
    </Box>
  );
}

/** "Základní 4/10 zapsáno" with a thin bar, per činnost. */
export function PortalProgress({ portal, t }: { portal: ClubPortal; t: PortalTexts }) {
  if (portal.activities.length === 0) return null;
  return (
    <Panel labelledBy="portal-progress-title">
      <PanelTitle id="portal-progress-title">{t['formulare.club-order.portal.progress.title']}</PanelTitle>
      <Box component="ul" data-testid="portal-progress" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {portal.activities.map((a) => {
          const line = t['formulare.club-order.portal.progress.line']
            .replace('{name}', a.name).replace('{registered}', String(a.registered)).replace('{seats}', String(a.seats));
          const percent = percentOf(a.registered, a.seats);
          /* Etapa 12: the price per player beside the činnost; "bez ceny" when the server sends none. */
          const price = a.priceCzk === null
            ? t['formulare.club-order.portal.price.none']
            : t['formulare.club-order.portal.price.perplayer'].replace('{price}', czk(a.priceCzk));
          return (
            <Box component="li" key={a.activityId} data-testid="portal-progress-row" sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '2px 12px', alignItems: 'baseline' }}>
                <Typography sx={{ fontSize: 15.5, fontWeight: 600 }}>{line}</Typography>
                <Typography data-testid="portal-progress-price" sx={{ fontSize: 14, color: LABEL_COLOR, fontVariantNumeric: 'tabular-nums' }}>{price}</Typography>
              </Box>
              <Box
                role="progressbar"
                aria-label={line}
                aria-valuemin={0}
                aria-valuemax={Math.max(a.seats, 0)}
                aria-valuenow={Math.min(a.registered, Math.max(a.seats, 0))}
                sx={{ height: 6, borderRadius: 3, bgcolor: BRAND.line, overflow: 'hidden' }}
              >
                <Box data-testid="portal-progress-bar" data-percent={percent} sx={{ width: `${percent}%`, height: '100%', bgcolor: BRAND.accent, borderRadius: 3 }} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Panel>
  );
}

function PriceRow({ label, value, strong = false, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'baseline' }}>
      <Typography component="span" sx={{ fontSize: strong ? 16 : 15, fontWeight: strong ? 700 : 400, color: strong ? BRAND.text : SOFT_TEXT }}>{label}</Typography>
      <Typography component="span" data-testid={testId} sx={{ fontFamily: ARCHIVO, fontSize: strong ? 22 : 15, fontWeight: strong ? 800 : 600, color: BRAND.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Etapa 12, "Ceny doplnit všude": what the order costs. The server's list total, its discounts and the total; the
 * group's total when the order shares an invoice with others; and where the invoicing stands (hradí klub / k
 * fakturaci / fakturováno), or that each player pays for themselves. Nothing here adds anything up.
 */
export function PortalPrices({ portal, t }: { portal: ClubPortal; t: PortalTexts }) {
  const quote = portal.priceQuote;
  const perPerson = portal.paymentMethod === 'PerPerson';
  const billing = portal.billing;
  const state = perPerson
    ? t['formulare.club-order.portal.price.person']
    : billing.state === 'Invoiced'
      ? t['formulare.club-order.portal.price.invoiced'].replace('{number}', billing.invoiceNumber ?? '').replace(/\s*·\s*$/, '')
      : billing.state === 'ToInvoice'
        ? t['formulare.club-order.portal.price.toinvoice']
        : portal.paymentMethod === 'ClubInvoice' ? t['formulare.club-order.portal.price.club'] : '';
  return (
    <Panel labelledBy="portal-price-title">
      <PanelTitle id="portal-price-title">{t['formulare.club-order.portal.price.title']}</PanelTitle>
      {quote === null ? (
        <Typography data-testid="portal-price-empty" sx={{ fontSize: 15, color: LABEL_COLOR }}>{t['formulare.club-order.portal.price.unpriced']}</Typography>
      ) : (
        <Box data-testid="portal-price" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {(quote.discounts.length > 0 || quote.listTotalCzk !== quote.totalCzk) && (
            <PriceRow label={t['formulare.club-order.portal.price.list']} value={czk(quote.listTotalCzk)} testId="portal-price-list" />
          )}
          {quote.discounts.map((d, i) => (
            <PriceRow key={`${d.label}-${i}`} label={d.label} value={`−${czk(Math.abs(d.amountCzk))}`} />
          ))}
          <Box sx={{ borderTop: `1px solid ${BRAND.line}`, pt: 1 }}>
            <PriceRow label={t['formulare.club-order.portal.price.total']} value={czk(quote.totalCzk)} strong testId="portal-price-total" />
          </Box>
          {portal.groupPriceQuote !== null && portal.groupPriceQuote.totalCzk !== quote.totalCzk && (
            <PriceRow label={t['formulare.club-order.portal.price.group']} value={czk(portal.groupPriceQuote.totalCzk)} testId="portal-price-group" />
          )}
        </Box>
      )}
      {state !== '' && (
        <Typography data-testid="portal-billing" data-state={perPerson ? 'PerPerson' : billing.state} sx={{ fontSize: 15, color: SOFT_TEXT, lineHeight: 1.5 }}>
          {state}
        </Typography>
      )}
    </Panel>
  );
}

/** "Změny od ordinace": the desk's notices, newest first; the last 7 days are marked. */
export function PortalNotices({ portal, t, now }: { portal: ClubPortal; t: PortalTexts; now?: number }) {
  return (
    <Panel labelledBy="portal-notices-title">
      <PanelTitle id="portal-notices-title">{t['formulare.club-order.portal.notices.title']}</PanelTitle>
      {portal.notices.length === 0 ? (
        <Typography data-testid="portal-notices-empty" sx={{ fontSize: 15, color: LABEL_COLOR }}>{t['formulare.club-order.portal.notices.empty']}</Typography>
      ) : (
        <Box component="ol" data-testid="portal-notices" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {portal.notices.map((n, i) => {
            const fresh = isFresh(n, now);
            return (
              <Box
                component="li"
                key={`${n.atUtc}-${i}`}
                data-testid="portal-notice"
                data-fresh={fresh}
                sx={{ pl: 1.75, py: '2px', borderLeft: `3px solid ${fresh ? BRAND.accent : BRAND.line}`, display: 'flex', flexDirection: 'column', gap: '2px' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FieldLabel>{n.atUtc !== '' && Number.isFinite(Date.parse(n.atUtc)) ? longWhen(n.atUtc) : ''}</FieldLabel>
                  {fresh && (
                    <Box component="span" sx={{ fontSize: 11, fontWeight: 700, px: '8px', py: '1px', borderRadius: '10px', bgcolor: BRAND.accentWash, border: `1px solid ${BRAND.accentEdge}`, color: BRAND.text }}>
                      {t['formulare.club-order.portal.notices.new']}
                    </Box>
                  )}
                </Box>
                <Typography sx={{ fontSize: 15.5, color: BRAND.text, lineHeight: 1.5, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}>{n.text}</Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Panel>
  );
}

/** The clinic's phone and e-mail as plain, selectable text. */
export function PortalContact({ phone, email, t }: { phone: string; email: string; t: PortalTexts }) {
  if (phone === '' && email === '') return null;
  return (
    <Panel labelledBy="portal-contact-title">
      <PanelTitle id="portal-contact-title">{t['formulare.club-order.portal.contact.title']}</PanelTitle>
      <Typography sx={{ fontSize: 15.5, color: SOFT_TEXT, lineHeight: 1.5 }}>{t['formulare.club-order.portal.contact.text']}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, userSelect: 'text' }}>
        {phone !== '' && <Typography data-testid="portal-phone" sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 18, userSelect: 'text' }}>{phone}</Typography>}
        {email !== '' && <Typography data-testid="portal-email" sx={{ fontSize: 16, overflowWrap: 'anywhere', userSelect: 'text' }}>{email}</Typography>}
      </Box>
    </Panel>
  );
}
