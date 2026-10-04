/* ══════════════════════════════════════════════════════════════
   OBJEDNÁVKA PRO KLUB  (route: /klub-objednavka/:token)

   The link the clinic sends a club. The club (or a worker for it) states ONE service,
   the činnosti with the number of players, one or more terms, the payment method and a
   contact. It is a REQUEST: nothing is reserved until the clinic processes it, and the
   club cannot change it afterwards (409 → "call us").

   Everything numeric (prices, total players, needed time, the minimum of players, the
   discounts) is the server's answer (`quote`); clinic-worded sentences are editable
   slots (formulare.club-order.*). Phone: one column, the price card above the footer
   and the button pinned. Tablet / desktop: form beside a sticky price card.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import {
  ClubOrderLinkError, ClubOrderValidationError, getOrderForm, quoteOrder, submitOrder,
} from '../../api/publicClubOrder';
import type { OrderForm, OrderQuote } from '../../api/publicClubOrder';
import { usePublicClinic } from '../../web/data';
import { useDevice } from '../../layout/useDevice';
import { useSlotTexts } from '../../site/useSlotTexts';
import PublicLayout from './PublicLayout';
import { PageTitle, PinnedBar, PublicMain, LoadError, ctaSx } from '../../components/public/kit';
import { telHref } from '../../components/public/brand';
import {
  ActivitySection, ContactSection, PaymentSection, ServiceSection, TermsSection,
} from './clubOrder/Sections';
import { SummaryCard } from './clubOrder/SummaryCard';
import type { SummaryLine } from './clubOrder/SummaryCard';
import { Confirmation, Loading, NoticePage } from './clubOrder/Screens';
import {
  MAX_SEATS, activitySeatsOf, emptyState, isValid, newTerm, sortFieldErrors, stateFromDraft, submitPayload, todayPrague,
} from './clubOrder/model';
import type { FieldKey, OrderState } from './clubOrder/model';

const QUOTE_DELAY_MS = 350;

const SLOT_KEYS = [
  'formulare.club-order.next',
  'formulare.club-order.terms.hint',
  'formulare.club-order.price.note',
  'formulare.club-order.minimum',
  'formulare.club-order.thanks.title',
  'formulare.club-order.thanks.next',
  'formulare.club-order.thanks.change',
  'formulare.club-order.processed',
  'formulare.club-order.gone',
  'formulare.club-order.notfound',
] as const;

type Load =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'dead'; reason: 'notFound' | 'gone' | 'processed' }
  | { kind: 'ready'; form: OrderForm };

export default function ClubOrderForm() {
  const { token = '' } = useParams<{ token: string }>();
  const clinic = usePublicClinic();
  const device = useDevice();
  const t = useSlotTexts(SLOT_KEYS);

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [state, setState] = useState<OrderState>(emptyState);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [quotePending, setQuotePending] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<FieldKey, string[]>>>({});
  const [done, setDone] = useState<{ reference: string; snapshot: OrderState; quote: OrderQuote | null } | null>(null);
  const today = useMemo(todayPrague, []);

  const fetchForm = useCallback(() => {
    setLoad({ kind: 'loading' });
    getOrderForm(token).then((form) => {
      if (form.status !== 'Invited') {
        setLoad({ kind: 'dead', reason: 'processed' });
        return;
      }
      setState(stateFromDraft(form.draft, form));
      setLoad({ kind: 'ready', form });
    }).catch((error: unknown) => {
      setLoad(error instanceof ClubOrderLinkError ? { kind: 'dead', reason: error.kind } : { kind: 'error' });
    });
  }, [token]);

  useEffect(() => { fetchForm(); }, [fetchForm]);

  const form = load.kind === 'ready' ? load.form : null;
  const service = form?.services.find((s) => s.serviceId === state.serviceId) ?? null;
  const seatsKey = JSON.stringify(activitySeatsOf(state.seats));

  /* Live price: debounced, and an older request is cancelled when a newer one is made. */
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (form === null) return undefined;
    const activitySeats = JSON.parse(seatsKey) as { activityId: string; seats: number }[];
    abortRef.current?.abort();
    if (state.serviceId === null || activitySeats.length === 0) {
      setQuote(null);
      setQuoteFailed(false);
      setQuotePending(false);
      return undefined;
    }
    setQuotePending(true);
    const serviceId = state.serviceId;
    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      quoteOrder(token, { serviceId, activitySeats }, controller.signal).then((q) => {
        if (controller.signal.aborted) return;
        setQuote(q);
        setQuoteFailed(false);
        setQuotePending(false);
      }).catch((error: unknown) => {
        if (controller.signal.aborted || axios.isCancel(error)) return;
        setQuote(null);
        setQuoteFailed(true);
        setQuotePending(false);
      });
    }, QUOTE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [form, token, state.serviceId, seatsKey]);

  const patch = (p: Partial<OrderState>) => setState((s) => ({ ...s, ...p }));
  const clearErrors = (key: FieldKey) => setServerErrors((e) => (e[key] === undefined ? e : { ...e, [key]: undefined }));

  const phone = clinic.phone.trim();
  const callPage = (title: string, text: string) => (
    <PublicLayout><NoticePage title={title} text={text} phone={phone} /></PublicLayout>
  );

  if (load.kind === 'loading') return <PublicLayout><Loading /></PublicLayout>;
  if (load.kind === 'error') {
    return (
      <PublicLayout>
        <PublicMain maxWidth={640}><LoadError what="Objednávku se nepodařilo načíst." onRetry={fetchForm} /></PublicMain>
      </PublicLayout>
    );
  }
  if (load.kind === 'dead') {
    if (load.reason === 'processed') return callPage('Objednávka je u nás', t['formulare.club-order.processed']);
    if (load.reason === 'gone') return callPage('Objednávka byla zrušena', t['formulare.club-order.gone']);
    return callPage('Odkaz neplatí', t['formulare.club-order.notfound']);
  }

  const offer = load.form;

  if (done !== null) {
    const svc = offer.services.find((s) => s.serviceId === done.snapshot.serviceId);
    return (
      <PublicLayout>
        <Confirmation
          title={t['formulare.club-order.thanks.title']}
          next={t['formulare.club-order.thanks.next']}
          change={t['formulare.club-order.thanks.change']}
          reference={done.reference}
          serviceName={svc?.serviceName ?? ''}
          lines={(svc?.activities ?? []).filter((a) => (done.snapshot.seats[a.activityId] ?? 0) > 0).map((a) => ({ name: a.name, seats: done.snapshot.seats[a.activityId] }))}
          terms={done.snapshot.terms}
          quote={done.quote}
          paymentLabel={done.snapshot.payment === 'PerPerson' ? 'Platí jednotlivé osoby' : 'Faktura klubu'}
          phone={phone}
        />
      </PublicLayout>
    );
  }

  const valid = isValid(state, today);
  const lines: SummaryLine[] = (service?.activities ?? [])
    .filter((a) => (state.seats[a.activityId] ?? 0) > 0)
    .map((a) => ({ activity: a, seats: state.seats[a.activityId] }));
  const minimumHint = offer.minimumPlayers === null
    ? null
    : t['formulare.club-order.minimum'].replace('{count}', String(offer.minimumPlayers));

  const onSubmit = async () => {
    setShowProblems(true);
    if (!valid || submitting) return;
    setSubmitting(true);
    setServerErrors({});
    try {
      const result = await submitOrder(token, submitPayload(state));
      setDone({ reference: result.reference, snapshot: state, quote });
    } catch (error) {
      if (error instanceof ClubOrderValidationError) setServerErrors(sortFieldErrors(error.errors));
      else if (error instanceof ClubOrderLinkError) setLoad({ kind: 'dead', reason: error.kind });
      else setServerErrors({ other: ['Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.'] });
    } finally {
      setSubmitting(false);
    }
  };

  const sections = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0 }}>
      <ServiceSection
        services={offer.services}
        value={state.serviceId}
        errors={serverErrors.serviceId}
        onChange={(id) => {
          if (id !== state.serviceId) patch({ serviceId: id, seats: {} });
          clearErrors('serviceId');
        }}
      />
      <ActivitySection
        service={service}
        seats={state.seats}
        errors={serverErrors.activitySeats}
        onChange={(id, n) => { patch({ seats: { ...state.seats, [id]: Math.max(0, Math.min(MAX_SEATS, n)) } }); clearErrors('activitySeats'); }}
      />
      <TermsSection
        terms={state.terms}
        today={today}
        hint={t['formulare.club-order.terms.hint']}
        showProblems={showProblems}
        errors={serverErrors.ranges}
        onChange={(id, p) => { patch({ terms: state.terms.map((r) => (r.id === id ? { ...r, ...p } : r)) }); clearErrors('ranges'); }}
        onAdd={() => patch({ terms: [...state.terms, newTerm()] })}
        onRemove={(id) => patch({ terms: state.terms.filter((r) => r.id !== id) })}
      />
      <PaymentSection
        methods={offer.paymentMethods}
        value={state.payment}
        showRequired={showProblems}
        errors={serverErrors.paymentMethod}
        onChange={(m) => { patch({ payment: m }); clearErrors('paymentMethod'); }}
      />
      <ContactSection
        value={state.contact}
        note={state.note}
        showProblems={showProblems}
        errors={{ name: serverErrors.name, phone: serverErrors.phone, email: serverErrors.email, note: serverErrors.note }}
        onChange={(p) => patch({ contact: { ...state.contact, ...p } })}
        onNote={(note) => patch({ note })}
      />
    </Box>
  );

  const summary = (
    <SummaryCard
      lines={lines}
      quote={quote}
      pending={quotePending}
      failed={quoteFailed}
      minimumHint={minimumHint}
      priceNote={t['formulare.club-order.price.note']}
      sticky={device !== 'phone'}
    />
  );

  const footer = (
    <PinnedBar label="Odeslání objednávky">
      <Button
        onClick={() => { void onSubmit(); }}
        disabled={!valid || submitting}
        sx={ctaSx(52)}
        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
      >
        Odeslat objednávku
      </Button>
    </PinnedBar>
  );

  return (
    <PublicLayout>
      <PublicMain maxWidth={1100}>
        <PageTitle sub={t['formulare.club-order.next']}>{`Objednávka pro klub ${offer.clubName}`}</PageTitle>
        {phone !== '' && (
          <Box sx={{ fontSize: 15 }}>Potřebujete poradit? Zavolejte nám: <a href={telHref(phone)}>{phone}</a></Box>
        )}
        {device === 'phone' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {sections}
            {summary}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { md: 'minmax(0, 1fr) 300px', lg: 'minmax(0, 1fr) 360px' }, gap: 3, alignItems: 'start' }}>
            {sections}
            {summary}
          </Box>
        )}
        {(serverErrors.other ?? []).map((m) => <Alert key={m} severity="error">{m}</Alert>)}
        {footer}
      </PublicMain>
    </PublicLayout>
  );
}
