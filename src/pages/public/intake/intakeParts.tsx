/* ══════════════════════════════════════════════════════════════
   THE PARTS OF THE REGISTRATION PAGE  (artboards V-Dotaznik, V-Rezervace)

   Kept out of IntakeQuestionnaire.tsx, which holds the form's logic: the
   reservation card at the top ("Vaše rezervace: …" and the deadline), the
   calm page for a link that has expired, the list of documents a činnost asks
   for, and the theme the form's fields wear.

   Nothing here is a text the clinic can change: the činnost, the time, the
   deadline and the documents are the API's; the clinic's telephone is read from
   the public clinic settings.
   ══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { EventAvailableOutlined, DescriptionOutlined, PhoneOutlined } from '@mui/icons-material';
import { LANDING_PATH } from '../../../components/public/PublicHeader';
import { ARCHIVO, BRAND, publicTheme, telHref } from '../../../components/public/brand';
import {
  FieldLabel, LABEL_COLOR, LoadError, Panel, PanelTitle, ctaSx, ghostSx, longWhen,
} from '../../../components/public/kit';
import type { CompletionDocument } from '../../../api/publicIntake';

/**
 * The public theme with the form's own measures: a 48 px field a thumb can hit
 * (the artboards), a 15 px label, the helper line close under the box.
 */
export const intakeTheme = createTheme(publicTheme, {
  components: {
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: 15, borderRadius: 11 },
        input: { paddingTop: 13, paddingBottom: 13 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 15 } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, marginTop: 6 } } },
  },
});

/** "Registraci dokončete do pondělí 26. října 10:00." */
export function deadlineSentence(deadlineUtc: string): string {
  const when = new Date(deadlineUtc).toLocaleString('cs-CZ', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Prague',
  });
  return `Registraci dokončete do ${when}.`;
}

/** The reservation the patient is finishing — at the top, because it is the reason they are here. */
export function ReservationSummary({
  activityName, serviceName, startUtc, deadlineUtc, held = false,
}: {
  activityName: string;
  serviceName?: string;
  startUtc: string | null;
  deadlineUtc?: string | null;
  /** A time held for the patient while they type, from the booking page. */
  held?: boolean;
}) {
  const name = activityName.trim();
  const headline = [name, startUtc !== null && startUtc !== '' ? longWhen(startUtc) : ''].filter((p) => p !== '').join(', ');
  return (
    <Box
      component="section"
      aria-label="Vaše rezervace"
      data-testid="reservation-summary"
      sx={{
        display: 'flex', gap: 1.75, alignItems: 'flex-start', p: '18px 20px', bgcolor: BRAND.paper,
        border: `1px solid ${BRAND.line}`, borderLeft: `4px solid ${BRAND.accent}`, borderRadius: '16px',
      }}
    >
      <EventAvailableOutlined sx={{ color: BRAND.accentDark, mt: '2px' }} aria-hidden />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
        <FieldLabel>{held ? 'Držíme vám termín' : 'Dokončení registrace'}</FieldLabel>
        <Typography sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 18, lineHeight: 1.3 }}>
          Vaše rezervace: {headline}
        </Typography>
        {serviceName !== undefined && serviceName.trim() !== '' && (
          <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>{serviceName}</Typography>
        )}
        {deadlineUtc !== undefined && deadlineUtc !== null && deadlineUtc !== '' && (
          <Typography sx={{ fontSize: 14, color: BRAND.warn, fontWeight: 600 }}>{deadlineSentence(deadlineUtc)}</Typography>
        )}
      </Box>
    </Box>
  );
}

/** The documents the admin asked for on this činnost. Rendered only when there are some. */
export function RequiredDocuments({ documents }: { documents: CompletionDocument[] }) {
  if (documents.length === 0) return null;
  return (
    <Panel labelledBy="required-documents">
      <PanelTitle id="required-documents">Dokumenty k této návštěvě</PanelTitle>
      <Typography sx={{ fontSize: 14, color: LABEL_COLOR }}>
        Tyto dokumenty ordinace pro vaši činnost vyžaduje.
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {documents.map((doc) => (
          <Box
            component="li"
            key={doc.templateId || doc.name}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 44, px: 1.75, border: `1px solid ${BRAND.line}`, borderRadius: '12px' }}
          >
            <DescriptionOutlined sx={{ color: BRAND.accentDark }} aria-hidden />
            <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{doc.name}</Typography>
          </Box>
        ))}
      </Box>
    </Panel>
  );
}

/**
 * A link that no longer opens a registration.
 *
 * `expired` is the 410: the deadline passed, the reservation was cancelled and
 * the time is free again — said calmly, with the two ways forward (call, or pick
 * a new time). `missing` is an unknown or already used link; `failed` is a load
 * that did not work and may simply be tried again.
 */
export function LinkProblem({
  kind, phone, onRetry,
}: {
  kind: 'expired' | 'missing' | 'failed';
  phone: string;
  onRetry?: () => void;
}) {
  const number = phone.trim();
  if (kind === 'failed') {
    return (
      <LoadError what="Registraci se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu." onRetry={onRetry} />
    );
  }
  const message = kind === 'expired'
    ? 'Tento odkaz už vypršel. Rezervace byla zrušena, zavolejte nám prosím nebo si vyberte nový termín.'
    : 'Tento odkaz už není platný nebo byl použit. Zavolejte nám prosím nebo si vyberte nový termín.';
  return (
    <Panel sx={{ alignItems: 'flex-start' }}>
      <PanelTitle>{kind === 'expired' ? 'Odkaz vypršel' : 'Odkaz neplatí'}</PanelTitle>
      <Typography role="status" sx={{ fontSize: 16, color: '#5C6067', lineHeight: 1.6, maxWidth: '56ch' }}>{message}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <Button variant="contained" href={LANDING_PATH} sx={ctaSx(50)}>Vybrat nový termín</Button>
        {number !== '' && (
          <Button variant="outlined" href={telHref(number)} startIcon={<PhoneOutlined />} sx={ghostSx(50)}>
            Zavolat {number}
          </Button>
        )}
      </Box>
    </Panel>
  );
}

/** A heading with the form step's number, in the artboards' Archivo. */
export function FormSection({ title, children, labelledBy }: { title: string; children: ReactNode; labelledBy: string }) {
  return (
    <Panel labelledBy={labelledBy}>
      <PanelTitle id={labelledBy}>{title}</PanelTitle>
      {children}
    </Panel>
  );
}
