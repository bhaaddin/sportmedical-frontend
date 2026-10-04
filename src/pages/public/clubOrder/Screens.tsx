import type { ReactNode } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';
import type { OrderQuote } from '../../../api/publicClubOrder';
import { ARCHIVO, BRAND, telHref } from '../../../components/public/brand';
import { FieldLabel, Panel, PanelTitle, PublicMain, SOFT_TEXT, ctaSx } from '../../../components/public/kit';
import { czk, hhmm } from './model';


export function Centered({ children }: { children: ReactNode }) {
  return <PublicMain maxWidth={640}>{children}</PublicMain>;
}

export function Loading() {
  return (
    <Centered>
      <Box role="status" aria-label="Načítám objednávku" sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    </Centered>
  );
}

/** A calm full-page notice (processed / cancelled / unknown link) with the clinic's phone when there is one. */
export function NoticePage({ title, text, phone }: { title: string; text: string; phone: string }) {
  return (
    <Centered>
      <Panel>
        <Typography component="h1" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 'clamp(24px, 3vw, 30px)' }}>{title}</Typography>
        <Typography sx={{ fontSize: 16, color: SOFT_TEXT, lineHeight: 1.55 }}>{text}</Typography>
        {phone !== '' && (
          <Button component="a" href={telHref(phone)} sx={{ ...ctaSx(52), alignSelf: 'flex-start', textDecoration: 'none' }}>
            Zavolat {phone}
          </Button>
        )}
      </Panel>
    </Centered>
  );
}

export interface ConfirmationProps {
  title: string;
  next: string;
  change: string;
  reference: string;
  serviceName: string;
  lines: { name: string; seats: number }[];
  termText: string;
  perPerson: boolean;
  quote: OrderQuote | null;
  paymentLabel: string;
  phone: string;
}

export function Confirmation(p: ConfirmationProps) {
  return (
    <Centered>
      <Panel>
        <CheckCircleOutlined sx={{ fontSize: 44, color: BRAND.success }} aria-hidden="true" />
        <Typography component="h1" sx={{ m: 0, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 'clamp(26px, 3.2vw, 34px)' }}>{p.title}</Typography>
        <Box>
          <FieldLabel>Číslo objednávky</FieldLabel>
          <Typography data-testid="order-reference" sx={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 24 }}>{p.reference}</Typography>
        </Box>
        <PanelTitle>Shrnutí</PanelTitle>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: 15 }}>
          <li>Služba: {p.serviceName}</li>
          {p.lines.map((l) => <li key={l.name}>{l.name}: {l.seats} hráčů</li>)}
          <li>Termín: {p.termText}</li>
          <li>Platba: {p.paymentLabel}</li>
          {p.quote !== null && <li>Potřebný čas: {hhmm(p.quote.neededMinutes)}</li>}
          {p.quote !== null && <li>{p.perPerson ? 'Orientační cena celkem (každý platí za sebe)' : 'Cena celkem'}: {czk(p.quote.totalCzk)}</li>}
        </Box>
        <Typography sx={{ fontSize: 15.5, color: SOFT_TEXT, lineHeight: 1.55 }}>{p.next}</Typography>
        <Typography sx={{ fontSize: 15.5, color: SOFT_TEXT, lineHeight: 1.55 }}>
          {p.change}{p.phone !== '' ? <> <a href={telHref(p.phone)}>{p.phone}</a></> : null}
        </Typography>
      </Panel>
    </Centered>
  );
}
