/* ══════════════════════════════════════════════════════════════
   PORTÁL KLUBU  (the page of /klub-objednavka/:token once the order is no longer an open invitation)

   Read-only and calm: the club, the service, the reference and the status; one sentence about the status; a
   month calendar of the windows the clinic gave the club (tap a day: that day's hours and činnosti, and the
   players booked in them); how far each činnost is registered; "Změny od ordinace"; the link for the players and
   parents once the order is confirmed; the clinic's phone and e-mail. A cancelled order shows the desk's message
   instead of the calendar. Everything the clinic words is an editable slot (formulare.club-order.portal.*).
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { ClubPortal, PortalStatus } from '../../../api/publicClubOrder';
import { useDevice } from '../../../layout/useDevice';
import { ARCHIVO, BRAND } from '../../../components/public/brand';
import { PageTitle, Panel, PanelTitle, PublicMain, SOFT_TEXT, LABEL_COLOR, NoticeBox } from '../../../components/public/kit';
import { LinkCard } from './LinkCard';
import { PortalCalendar } from './PortalCalendar';
import { PortalContact, PortalDay, PortalNotices, PortalPrices, PortalProgress } from './PortalSections';
import type { PortalTexts } from './PortalSections';
import { latestNotice, windowsByDate } from './portalModel';

type Shown = Exclude<PortalStatus, 'Invited'>;
const todayPrague = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

function StatusChip({ status, label }: { status: Shown; label: string }) {
  const tone = status === 'Confirmed'
    ? { bg: BRAND.successWash, fg: BRAND.success }
    : status === 'Requested' ? { bg: BRAND.warnWash, fg: BRAND.warn } : { bg: '#EFECE6', fg: '#4A463F' };
  return (
    <Box
      component="span"
      data-testid="portal-status"
      data-status={status}
      sx={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', px: '12px', py: '4px', borderRadius: '14px', fontSize: 13.5, fontWeight: 700, bgcolor: tone.bg, color: tone.fg }}
    >
      {label}
    </Box>
  );
}

export function ClubPortalPage({ portal, t, stale = false }: {
  portal: ClubPortal;
  t: PortalTexts;
  /** The last refresh failed: the data on screen is the last one that loaded. */
  stale?: boolean;
}) {
  const device = useDevice();
  const [day, setDay] = useState<string | null>(null);
  const status: Shown = portal.status === 'Invited' ? 'Requested' : portal.status;
  const cancelled = status === 'Cancelled';
  const today = useMemo(() => todayPrague(), []);

  const byDate = useMemo(() => windowsByDate(portal.windows), [portal.windows]);
  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);
  const counts = useMemo(() => new Map([...byDate].map(([date, list]) => [date, list.length])), [byDate]);

  const chip = t[`formulare.club-order.portal.chip.${status.toLowerCase() as Lowercase<Shown>}`];
  const sentence = t[`formulare.club-order.portal.status.${status.toLowerCase() as Lowercase<Shown>}`];
  const reference = t['formulare.club-order.portal.reference']
    .replace('{service}', portal.serviceName).replace('{reference}', portal.reference)
    .replace(/^\s*·\s*|\s*·\s*$/g, '');
  const message = latestNotice(portal);
  const side = device !== 'phone';

  return (
    <PublicMain maxWidth={960}>
      <Box data-testid="club-portal" data-status={status} data-layout={device} sx={{ display: 'contents' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <PageTitle sub={reference}>{portal.clubName}</PageTitle>
          <StatusChip status={status} label={chip} />
          <Typography data-testid="portal-status-text" sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 19, color: BRAND.text }}>{sentence}</Typography>
        </Box>

        {stale && <NoticeBox tone="plain"><span data-testid="portal-stale">{t['formulare.club-order.portal.stale']}</span></NoticeBox>}

        {cancelled ? (
          <Panel labelledBy="portal-cancelled-title" sx={{ bgcolor: BRAND.page }}>
            <PanelTitle id="portal-cancelled-title">{t['formulare.club-order.portal.cancelled.title']}</PanelTitle>
            <Typography data-testid="portal-cancelled-text" sx={{ fontSize: 16, color: message !== null ? BRAND.text : SOFT_TEXT, lineHeight: 1.55, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
              {message !== null ? message.text : t['formulare.club-order.portal.cancelled.text']}
            </Typography>
          </Panel>
        ) : (
          <>
            <Panel labelledBy="portal-cal-title">
              <PanelTitle id="portal-cal-title">{t['formulare.club-order.portal.cal.title']}</PanelTitle>
              {dates.length === 0 ? (
                <Typography role="status" data-testid="portal-cal-empty" sx={{ fontSize: 15, color: LABEL_COLOR }}>{t['formulare.club-order.portal.cal.empty']}</Typography>
              ) : (
                <>
                  <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{t['formulare.club-order.portal.cal.hint']}</Typography>
                  <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: side ? 'minmax(300px, 380px) minmax(0, 1fr)' : 'minmax(0, 1fr)', alignItems: 'start' }}>
                    <PortalCalendar dates={dates} counts={counts} day={day} onDay={setDay} today={today} />
                    <PortalDay portal={portal} day={day} t={t} />
                  </Box>
                </>
              )}
            </Panel>
            <PortalProgress portal={portal} t={t} />
            <PortalPrices portal={portal} t={t} />
          </>
        )}

        <PortalNotices portal={portal} t={t} />

        {portal.registrationUrl !== null && !cancelled && (
          <LinkCard
            path={portal.registrationUrl}
            t={{
              title: t['formulare.club-order.link.title'],
              text: t['formulare.club-order.link.text'],
              copy: t['formulare.club-order.link.copy'],
              copied: t['formulare.club-order.link.copied'],
            }}
          />
        )}

        <PortalContact phone={portal.clinic.phone} email={portal.clinic.email} t={t} />
      </Box>
    </PublicMain>
  );
}

export default ClubPortalPage;
