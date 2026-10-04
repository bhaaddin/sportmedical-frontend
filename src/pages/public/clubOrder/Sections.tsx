import type { ReactNode } from 'react';
import { Box, Button, ButtonBase, IconButton, TextField, Typography } from '@mui/material';
import { AddRounded, DeleteOutlineRounded, RemoveRounded } from '@mui/icons-material';
import type { ClubPaymentMethod, OrderActivity, OrderService } from '../../../api/publicClubOrder';
import { ARCHIVO, BRAND } from '../../../components/public/brand';
import { Panel, PanelTitle, SOFT_TEXT, ghostSx } from '../../../components/public/kit';
import { PhoneField } from '../../../components/ui/PhoneField';
import { MAX_SEATS, contactProblems, czk, termProblem } from './model';
import type { ContactState, TermRow } from './model';

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

export function ServiceSection({
  services, value, onChange, errors,
}: { services: OrderService[]; value: string | null; onChange: (id: string) => void; errors?: string[] }) {
  return (
    <Panel labelledBy="co-service">
      <PanelTitle id="co-service">Služba</PanelTitle>
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
  service, seats, onChange, errors,
}: { service: OrderService | null; seats: Record<string, number>; onChange: (activityId: string, n: number) => void; errors?: string[] }) {
  return (
    <Panel labelledBy="co-activities">
      <PanelTitle id="co-activities">Činnosti a počet hráčů</PanelTitle>
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
                <Typography sx={{ fontSize: 13.5, color: SOFT_TEXT }}>{a.durationMinutes} min · {czk(a.unitPriceCzk)} za hráče</Typography>
              </Box>
              <Stepper activity={a} value={seats[a.activityId] ?? 0} onChange={(n) => onChange(a.activityId, n)} />
            </Box>
          ))}
        </Box>
      )}
      <FieldErrors messages={errors} />
    </Panel>
  );
}

export function TermsSection({
  terms, today, hint, showProblems, onChange, onAdd, onRemove, errors,
}: {
  terms: TermRow[]; today: string; hint: string; showProblems: boolean;
  onChange: (id: number, patch: Partial<TermRow>) => void; onAdd: () => void; onRemove: (id: number) => void; errors?: string[];
}) {
  return (
    <Panel labelledBy="co-terms">
      <PanelTitle id="co-terms">Termíny</PanelTitle>
      <Typography sx={{ fontSize: 14.5, color: SOFT_TEXT }}>{hint}</Typography>
      {terms.map((t, i) => {
        const problem = termProblem(t, today);
        const dateProblem = t.date !== '' && t.date < today;
        const shown = (showProblems || dateProblem) && problem !== null ? problem : null;
        return (
          <Box key={t.id} role="group" aria-label={`Termín ${i + 1}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'flex-end' }}>
              <TextField
                label="Datum" type="date" value={t.date} error={shown !== null && (t.date === '' || dateProblem)}
                onChange={(e) => onChange(t.id, { date: e.target.value })}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, 'aria-label': `Datum termínu ${i + 1}` } }}
                sx={{ flex: '1 1 160px', '& .MuiInputBase-root': { minHeight: 48 } }}
              />
              <TextField
                label="Od" type="time" value={t.from} onChange={(e) => onChange(t.id, { from: e.target.value })}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `Čas od, termín ${i + 1}` } }}
                sx={{ flex: '1 1 110px', '& .MuiInputBase-root': { minHeight: 48 } }}
              />
              <TextField
                label="Do" type="time" value={t.to} onChange={(e) => onChange(t.id, { to: e.target.value })}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `Čas do, termín ${i + 1}` } }}
                sx={{ flex: '1 1 110px', '& .MuiInputBase-root': { minHeight: 48 } }}
              />
              {terms.length > 1 && (
                <IconButton aria-label={`Odebrat termín ${i + 1}`} onClick={() => onRemove(t.id)} sx={{ width: 48, height: 48 }}>
                  <DeleteOutlineRounded />
                </IconButton>
              )}
            </Box>
            {shown !== null && <FieldErrors messages={[shown]} />}
          </Box>
        );
      })}
      <Box>
        <Button onClick={onAdd} startIcon={<AddRounded />} sx={ghostSx(44)}>+ Přidat další termín</Button>
      </Box>
      <FieldErrors messages={errors} />
    </Panel>
  );
}

const PAYMENT_TEXT: Record<ClubPaymentMethod, { title: string; sub: string }> = {
  ClubInvoice: { title: 'Faktura klubu', sub: 'Celou objednávku zaplatí klub na fakturu.' },
  PerPerson: { title: 'Platí jednotlivé osoby', sub: 'Každý hráč platí za sebe.' },
};

export function PaymentSection({
  methods, value, onChange, errors, showRequired,
}: { methods: ClubPaymentMethod[]; value: ClubPaymentMethod | null; onChange: (m: ClubPaymentMethod) => void; errors?: string[]; showRequired: boolean }) {
  return (
    <Panel labelledBy="co-payment">
      <PanelTitle id="co-payment">Způsob platby</PanelTitle>
      <Box role="radiogroup" aria-labelledby="co-payment" aria-required="true" sx={cardGrid}>
        {methods.map((m) => (
          <ChoiceCard key={m} name={PAYMENT_TEXT[m].title} title={PAYMENT_TEXT[m].title} sub={PAYMENT_TEXT[m].sub} checked={value === m} onSelect={() => onChange(m)} />
        ))}
      </Box>
      {showRequired && value === null && <FieldErrors messages={['Vyberte způsob platby.']} />}
      <FieldErrors messages={errors} />
    </Panel>
  );
}

export function ContactSection({
  value, onChange, note, onNote, showProblems, errors,
}: {
  value: ContactState; onChange: (patch: Partial<ContactState>) => void; note: string; onNote: (n: string) => void;
  showProblems: boolean; errors: { name?: string[]; phone?: string[]; email?: string[]; note?: string[] };
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
      <PanelTitle id="co-contact">Kontakt</PanelTitle>
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
      <TextField label="Poznámka (nepovinná)" value={note} onChange={(e) => onNote(e.target.value)} multiline minRows={2} fullWidth />
      <FieldErrors messages={errors.note} />
    </Panel>
  );
}

