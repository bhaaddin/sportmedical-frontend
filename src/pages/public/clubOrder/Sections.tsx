import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Box, ButtonBase, IconButton, TextField, Typography } from '@mui/material';
import { AddRounded, RemoveRounded } from '@mui/icons-material';
import type { ClubPaymentMethod, OrderActivity, OrderService } from '../../../api/publicClubOrder';
import { ARCHIVO, BRAND } from '../../../components/public/brand';
import { Panel, PanelTitle, SOFT_TEXT } from '../../../components/public/kit';
import { DayCalendar } from '../../../components/clubs/orders/DayCalendar';
import type { DayCalendarColors } from '../../../components/clubs/orders/DayCalendar';
import { daysText, todayIso } from '../../../components/clubs/orders/dayOffer';
import { PhoneField } from '../../../components/ui/PhoneField';
import { MAX_SEATS, contactProblems, czk, termProblem } from './model';
import type { ContactState, TermState } from './model';

const PUBLIC_CALENDAR: DayCalendarColors = {
  accent: BRAND.accent, onAccent: BRAND.ink, wash: BRAND.accentWash, edge: BRAND.accentEdge, text: BRAND.text, muted: BRAND.faint, line: BRAND.line,
};

export function FieldErrors({ messages, id }: { messages?: string[]; id?: string }) {
  if (messages === undefined || messages.length === 0) return null;
  return (
    <Box id={id} role="alert" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      {messages.map((m) => (
        <Typography key={m} sx={{ fontSize: 13.5, color: '#B3261E' }}>{m}</Typography>
      ))}
    </Box>
  );
}

/** A big tappable card used as a radio (service, payment method). */
function ChoiceCard({
  checked, onSelect, title, sub, name,
}: { checked: boolean; onSelect: () => void; title: string; sub?: ReactNode; name: string }) {
  return (
    <ButtonBase
      role="radio"
      aria-checked={checked}
      aria-label={name}
      onClick={onSelect}
      sx={{
        minHeight: 56, p: '12px 16px', borderRadius: '12px', textAlign: 'left', justifyContent: 'flex-start', alignItems: 'flex-start',
        flexDirection: 'column', gap: 0.25,
        border: `${checked ? 2 : 1}px solid ${checked ? BRAND.accent : BRAND.line}`,
        bgcolor: checked ? BRAND.accentWash : BRAND.paper,
        '&:focus-visible': { outline: `3px solid ${BRAND.accentEdge}` },
      }}
    >
      <Typography component="span" sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 16, color: BRAND.text }}>{title}</Typography>
      {sub !== undefined && <Typography component="span" sx={{ fontSize: 13.5, color: SOFT_TEXT }}>{sub}</Typography>}
    </ButtonBase>
  );
}

const cardGrid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 } as const;

export function PaymentSection({
  value, onChange, errors, showRequired, texts, n,
}: {
  value: ClubPaymentMethod | null; onChange: (m: ClubPaymentMethod) => void; errors?: string[]; showRequired: boolean;
  texts: Record<ClubPaymentMethod, { title: string; sub: string }>; n: number;
}) {
  const methods: ClubPaymentMethod[] = ['ClubInvoice', 'PerPerson'];
  return (
    <Panel labelledBy="co-payment">
      <PanelTitle id="co-payment">{n}. Kdo platí? (povinné)</PanelTitle>
      <Box role="radiogroup" aria-labelledby="co-payment" aria-required="true" sx={cardGrid}>
        {methods.map((m) => (
          <ChoiceCard key={m} name={texts[m].title} title={texts[m].title} sub={texts[m].sub} checked={value === m} onSelect={() => onChange(m)} />
        ))}
      </Box>
      {showRequired && value === null && <FieldErrors messages={['Vyberte, kdo bude platit.']} />}
      <FieldErrors messages={errors} />
    </Panel>
  );
}

export function ServiceSection({
  services, value, onChange, errors, n,
}: { services: OrderService[]; value: string | null; onChange: (id: string) => void; errors?: string[]; n: number }) {
  return (
    <Panel labelledBy="co-service">
      <PanelTitle id="co-service">{n}. Služba</PanelTitle>
      <Box role="radiogroup" aria-labelledby="co-service" sx={cardGrid}>
        {services.map((s) => (
          <ChoiceCard
            key={s.serviceId}
            name={s.serviceName}
            title={s.serviceName}
            checked={value === s.serviceId}
            onSelect={() => onChange(s.serviceId)}
          />
        ))}
      </Box>
      <FieldErrors messages={errors} />
    </Panel>
  );
}

function Stepper({ activity, value, onChange }: { activity: OrderActivity; value: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(0, Math.min(MAX_SEATS, Number.isFinite(n) ? n : 0)));
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <IconButton aria-label={`Ubrat hráče: ${activity.name}`} onClick={() => set(value - 1)} disabled={value <= 0} sx={{ width: 44, height: 44, border: `1px solid ${BRAND.line}` }}>
        <RemoveRounded />
      </IconButton>
      <TextField
        value={value === 0 ? '' : String(value)}
        placeholder="0"
        onChange={(e) => set(parseInt(e.target.value.replace(/\D/g, ''), 10))}
        slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Počet hráčů: ${activity.name}`, style: { textAlign: 'center', width: 56, padding: '11px 4px' } } }}
        sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
      />
      <IconButton aria-label={`Přidat hráče: ${activity.name}`} onClick={() => set(value + 1)} disabled={value >= MAX_SEATS} sx={{ width: 44, height: 44, border: `1px solid ${BRAND.line}` }}>
        <AddRounded />
      </IconButton>
    </Box>
  );
}

export function ActivitySection({
  service, seats, onChange, errors, n, perPerson,
}: {
  service: OrderService | null; seats: Record<string, number>; onChange: (activityId: string, n: number) => void;
  errors?: string[]; n: number; perPerson: boolean;
}) {
  return (
    <Panel labelledBy="co-activities">
      <PanelTitle id="co-activities">{n}. Činnosti a počet hráčů</PanelTitle>
      {service === null ? (
        <Typography sx={{ color: SOFT_TEXT, fontSize: 15 }}>Nejdřív vyberte službu.</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {service.activities.map((a) => (
            <Box
              component="li"
              key={a.activityId}
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.25, p: '12px 14px', border: `1px solid ${BRAND.line}`, borderRadius: '12px' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: ARCHIVO, fontWeight: 700, fontSize: 16 }}>{a.name}</Typography>
                <Typography sx={{ fontSize: 13.5, color: SOFT_TEXT }}>
                  {a.durationMinutes} min · {czk(a.unitPriceCzk)} {perPerson ? '– cena za osobu' : 'za hráče'}
                </Typography>
              </Box>
              <Stepper activity={a} value={seats[a.activityId] ?? 0} onChange={(count) => onChange(a.activityId, count)} />
            </Box>
          ))}
        </Box>
      )}
      <FieldErrors messages={errors} />
    </Panel>
  );
}

export function TermSection({
  term, today, hint, showProblems, onChange, errors, n,
}: {
  term: TermState; today: string; hint: string; showProblems: boolean; onChange: (patch: Partial<TermState>) => void;
  errors?: string[]; n: number;
}) {
  const problem = termProblem(term, today);
  const shown = (showProblems || (term.from !== '' && (term.from < today || (term.to !== '' && term.to < term.from)))) && problem !== null ? problem : null;
  const field = { '& .MuiInputBase-root': { minHeight: 48 } } as const;
  return (
    <Panel labelledBy="co-term">
      <PanelTitle id="co-term">{n}. Termín</PanelTitle>
      <Typography sx={{ fontSize: 14.5, color: SOFT_TEXT }}>{hint}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        <TextField
          label="Od" type="date" value={term.from} required error={shown !== null}
          onChange={(e) => onChange({ from: e.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, 'aria-label': 'Termín od' } }}
          sx={{ flex: '1 1 150px', ...field }}
        />
        <TextField
          label="Do (nepovinné)" type="date" value={term.to}
          onChange={(e) => onChange({ to: e.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: term.from || today, 'aria-label': 'Termín do' } }}
          sx={{ flex: '1 1 150px', ...field }}
        />
      </Box>
      <FieldErrors messages={shown !== null ? [shown] : undefined} />
      <TextField
        label="Preferovaný čas (nepovinné)" placeholder="např. dopoledne, po 16. hodině" value={term.preferred}
        onChange={(e) => onChange({ preferred: e.target.value })} fullWidth
        slotProps={{ htmlInput: { 'aria-label': 'Preferovaný čas' } }} sx={field}
      />
      <FieldErrors messages={errors} />
    </Panel>
  );
}

export function ContactSection({
  value, onChange, showProblems, errors, n,
}: {
  value: ContactState; onChange: (patch: Partial<ContactState>) => void;
  showProblems: boolean; errors: { name?: string[]; phone?: string[]; email?: string[] }; n: number;
}) {
  const p = contactProblems(value);
  const msg = (own: string | null, server?: string[]): string[] | undefined =>
    server !== undefined && server.length > 0 ? server : showProblems && own !== null ? [own] : undefined;
  const nameE = msg(p.name, errors.name);
  const phoneE = msg(p.phone, errors.phone);
  const emailE = msg(p.email, errors.email);
  const field = { '& .MuiInputBase-root': { minHeight: 48 } } as const;
  return (
    <Panel labelledBy="co-contact">
      <PanelTitle id="co-contact">{n}. Kontakt</PanelTitle>
      <TextField
        label="Jméno a příjmení" required value={value.name} onChange={(e) => onChange({ name: e.target.value })}
        error={nameE !== undefined} autoComplete="name" fullWidth sx={field}
      />
      <FieldErrors messages={nameE} />
      <Box>
        <PhoneField
          label="Telefon" value={value.phone} onChange={(v) => onChange({ phone: v })} error={phoneE !== undefined} fullWidth
        />
        <FieldErrors messages={phoneE} />
      </Box>
      <TextField
        label="E-mail" required type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })}
        error={emailE !== undefined} autoComplete="email" fullWidth sx={field}
      />
      <FieldErrors messages={emailE} />
    </Panel>
  );
}

export function NoteSection({ note, onNote, errors, n }: { note: string; onNote: (v: string) => void; errors?: string[]; n: number }) {
  return (
    <Panel labelledBy="co-note">
      <PanelTitle id="co-note">{n}. Poznámka (nepovinná)</PanelTitle>
      <TextField label="Poznámka" value={note} onChange={(e) => onNote(e.target.value)} multiline minRows={2} fullWidth />
      <FieldErrors messages={errors} />
    </Panel>
  );
}

/** Etapa 8: instead of the free term, the club ticks days among the ones the clinic offered. */
export function DaysSection({
  offered, selected, onToggle, texts, showProblems, errors, n,
}: {
  offered: string[]; selected: string[]; onToggle: (date: string) => void;
  texts: { title: string; hint: string; empty: string; required: string; count: string };
  showProblems: boolean; errors?: string[]; n: number;
}) {
  const offeredSet = useMemo(() => new Set(offered), [offered]);
  const today = useMemo(todayIso, []);
  const first = offered.find((d) => d >= today) ?? offered[0] ?? today;
  const missing = showProblems && selected.length === 0;
  return (
    <Panel labelledBy="co-days">
      <PanelTitle id="co-days">{n}. {texts.title}</PanelTitle>
      <Typography sx={{ fontSize: 14.5, color: SOFT_TEXT }}>{texts.hint}</Typography>
      <DayCalendar
        selected={selected}
        onToggle={onToggle}
        isDisabled={(d) => !offeredSet.has(d) || d < today}
        marked={offeredSet}
        initialMonth={first}
        colors={PUBLIC_CALENDAR}
        testId="club-days-calendar"
        label="Nabízené dny"
      />
      <Typography sx={{ fontSize: 15, fontWeight: 600 }} data-testid="club-days-count" aria-live="polite">
        {texts.count.replace('{n}', String(selected.length))}
      </Typography>
      {selected.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: SOFT_TEXT }}>{texts.empty}</Typography>
      ) : (
        <Typography sx={{ fontSize: 15 }} data-testid="club-days-list">{daysText(selected)}</Typography>
      )}
      <FieldErrors messages={missing ? [texts.required] : undefined} />
      <FieldErrors messages={errors} />
    </Panel>
  );
}
