/*
 * "Nový doklad": who is it for (Osoba · Skupina · Tým), what is billed, what
 * the server says it costs, and send it - or, when the manual discount is above
 * the caller's limit, send it for approval.
 *
 * Three layouts: on a phone it is a full screen with the main action pinned to
 * the bottom; on an iPad one column in a dialog; on a desktop two columns with
 * the price breakdown beside the form. Entered from another screen it is
 * already filled in (see `pages/billing/invoicePrefill`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, TextField, Typography,
} from '@mui/material';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import type { Invoice } from '../../api/billing';
import { activitiesApi } from '../../api/activities';
import type { Activity } from '../../api/bookingContracts';
import { calendarsApi } from '../../api/calendars';
import { clubsApi } from '../../api/clubs';
import { partnerOrdersApi } from '../../api/partnerOrders';
import { patientsApi } from '../../api/patients';
import type { Patient } from '../../api/patients';
import { toBookingError } from '../../api/apiError';
import { useDevice } from '../../layout/useDevice';
import PatientPicker from '../patients/PatientPicker';
import { NumberSeriesPreview } from '../NumberSeriesPreview';
import { SectionLabel } from '../ui';
import {
  EMPTY_DRAFT, buildCreateRequest, buildQuoteRequest, draftProblems, parseManualPercent,
} from '../../pages/billing/invoiceDraft';
import type { InvoiceDraft } from '../../pages/billing/invoiceDraft';
import {
  addLine, linesFromActivities, recipientTypeFromState, wantsNewInvoice,
} from '../../pages/billing/invoicePrefill';
import type { BillingNavState } from '../../pages/billing/invoicePrefill';
import { formatPercent } from '../../pages/billing/invoiceView';
import ClubRecipientPicker from './ClubRecipientPicker';
import GroupRecipientForm from './GroupRecipientForm';
import InvoiceLinesEditor, { MAX_QUANTITY } from './InvoiceLinesEditor';
import QuotePanel from './QuotePanel';
import RecipientTypeButtons from './RecipientTypeButtons';
import { useInvoiceQuote } from './useInvoiceQuote';

export const SEND_LABEL = 'Vystavit doklad';
export const APPROVAL_LABEL = 'Odeslat ke schválení';

const billable = (a: Activity) => a.isActive && a.priceCzk !== null;

export default function NewInvoiceFlow({
  open,
  nav,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** What the screen was entered with, or `null` for a blank document. */
  nav: BillingNavState | null;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const desktop = device === 'desktop';

  const [draft, setDraft] = useState<InvoiceDraft>(EMPTY_DRAFT);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesFailed, setActivitiesFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /* Which opening of the dialog an async answer belongs to. */
  const session = useRef(0);

  const patch = useCallback((change: Partial<InvoiceDraft>) => setDraft((d) => ({ ...d, ...change })), []);

  const loadActivities = useCallback(async (): Promise<Activity[]> => {
    setActivitiesLoading(true);
    setActivitiesFailed(false);
    try {
      const { activities: all } = await activitiesApi.list();
      const rows = [...all].sort((a, b) => a.sortOrder - b.sortOrder);
      setActivities(rows);
      return rows;
    } catch {
      setActivitiesFailed(true);
      return [];
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  /* ── Opening: a blank document, or one filled in from the screen that sent us ── */
  useEffect(() => {
    if (!open) return;
    const mine = ++session.current;
    const alive = () => mine === session.current;

    setDraft(EMPTY_DRAFT);
    setPatient(null);
    setSubmitting(false);

    void (async () => {
      const rows = await loadActivities();
      if (!alive() || nav === null || !wantsNewInvoice(nav)) return;

      setDraft((d) => ({
        ...d,
        type: recipientTypeFromState(nav),
        appointmentId: nav.appointmentId ?? null,
        headcount: nav.headcount !== undefined ? String(nav.headcount) : d.headcount,
      }));

      if (nav.patientId !== undefined) {
        patientsApi.getById(nav.patientId)
          .then((p) => {
            if (!alive()) return;
            setPatient(p);
            setDraft((d) => ({ ...d, patientId: p.id }));
          })
          .catch(() => toast.error('Pacienta se nepodařilo načíst'));
      }
      if (nav.clubId !== undefined) {
        clubsApi.getById(nav.clubId)
          .then((c) => {
            if (!alive()) return;
            setDraft((d) => ({ ...d, club: { id: c.id, name: c.name, discountPercent: c.discountPercent ?? null } }));
          })
          .catch(() => toast.error('Klub se nepodařilo načíst'));
      }

      const wantsLines = nav.activityId !== undefined || nav.partnerOrderId !== undefined || nav.clubBlockId !== undefined;
      if (!wantsLines) return;

      try {
        const wanted: { activityId: string; count: number }[] = [];
        let headcount = nav.headcount;
        if (nav.activityId !== undefined) wanted.push({ activityId: nav.activityId, count: 1 });
        if (nav.partnerOrderId !== undefined) {
          const calendars = await calendarsApi.list();
          const lists = await Promise.allSettled(calendars.map((c) => partnerOrdersApi.list(c.id)));
          const order = lists
            .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
            .find((o) => o.id === nav.partnerOrderId);
          for (const item of order?.items ?? []) {
            wanted.push({ activityId: item.activityId, count: Math.max(1, item.requestedCount) });
          }
          if (headcount === undefined && order !== undefined && order.items.length > 0) {
            headcount = Math.max(...order.items.map((i) => Math.max(1, i.requestedCount)));
          }
        }
        if (nav.clubBlockId !== undefined) {
          const block = await billingApi.getClubBlock(nav.clubBlockId);
          const people = headcount ?? block.playerCount;
          headcount = people;
          for (const id of block.activityIds) wanted.push({ activityId: id, count: Math.max(1, people ?? 1) });
          if (nav.clubId === undefined) {
            setDraft((d) => (alive() ? { ...d, club: { id: block.clubId, name: block.clubName ?? 'Klub' } } : d));
          }
        }
        if (!alive()) return;
        const { lines: found, unpriced } = linesFromActivities(wanted, rows);
        setDraft((d) => ({
          ...d,
          headcount: headcount !== undefined && d.headcount === '' ? String(headcount) : d.headcount,
          lines: found.reduce((acc, l) => addLine(acc, l.activityId, l.quantity), d.lines),
        }));
        if (unpriced > 0) toast.error('Některá činnost nemá v ceníku položku - přidejte ji ručně');
      } catch {
        if (alive()) toast.error('Položky z objednávky se nepodařilo načíst - vyberte je z ceníku');
      }
    })();

    return () => { session.current += 1; };
    // `nav` identifies one opening; the callbacks are stable.
  }, [open, nav, loadActivities]);

  /* ── Lines ── */
  const toggleActivity = (id: string) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.some((l) => l.activityId === id)
        ? d.lines.filter((l) => l.activityId !== id)
        : addLine(d.lines, id),
    }));

  const setQuantity = (id: string, raw: number) => {
    const quantity = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(raw) || 1));
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.activityId === id ? { ...l, quantity } : l)) }));
  };

  /* ── The server's price ── */
  const { quote, status, error, retry, manualAllowedPercent } = useInvoiceQuote(buildQuoteRequest(draft));
  const manual = parseManualPercent(draft.manualPercent);
  const overLimit = status === 'ready' && quote !== null && quote.requiresApproval;

  const problems = draftProblems(draft, patient !== null);
  if (overLimit && draft.manualReason.trim() === '') problems.push('Uveďte důvod ruční slevy.');
  const ready = problems.length === 0 && status === 'ready' && quote !== null && !submitting;

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    try {
      const invoice = await billingApi.createInvoice(buildCreateRequest(draft));
      toast.success(overLimit || invoice.status === 'PendingApproval'
        ? 'Doklad odeslán ke schválení'
        : 'Doklad vystaven');
      onCreated(invoice);
      onClose();
    } catch (err) {
      toast.error(toBookingError(err).serverMessage ?? 'Doklad se nepodařilo vystavit');
    } finally {
      setSubmitting(false);
    }
  };

  const touch = device !== 'desktop';
  const billableActivities = activities.filter(billable);

  const recipient = (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <SectionLabel>Komu doklad vystavujete</SectionLabel>
        <RecipientTypeButtons value={draft.type} onChange={(type) => patch({ type })} />
      </Box>

      {draft.type === 'Person' && (
        <Box>
          <SectionLabel>Pacient</SectionLabel>
          <PatientPicker
            value={patient}
            onChange={(p) => {
              setPatient(p);
              patch({ patientId: p?.id ?? '' });
            }}
          />
        </Box>
      )}
      {draft.type === 'Group' && (
        <Box>
          <SectionLabel>Skupina nebo firma</SectionLabel>
          <GroupRecipientForm
            group={draft.group}
            headcount={draft.headcount}
            onGroupChange={(group) => patch({ group })}
            onHeadcountChange={(headcount) => patch({ headcount })}
          />
        </Box>
      )}
      {draft.type === 'Team' && (
        <Box>
          <SectionLabel>Klub</SectionLabel>
          <ClubRecipientPicker
            club={draft.club}
            headcount={draft.headcount}
            onClubChange={(club) => patch({ club })}
            onHeadcountChange={(headcount) => patch({ headcount })}
          />
        </Box>
      )}
    </Box>
  );

  const details = draft.type === null ? null : (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <SectionLabel>Položky z ceníku</SectionLabel>
        <InvoiceLinesEditor
          activities={billableActivities}
          lines={draft.lines}
          loading={activitiesLoading}
          failed={activitiesFailed}
          onRetry={() => void loadActivities()}
          onToggle={toggleActivity}
          onQuantity={setQuantity}
        />
      </Box>

      <Box>
        <SectionLabel>Ruční sleva</SectionLabel>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2 }}>
          <TextField
            label="Ruční sleva"
            value={draft.manualPercent}
            onChange={(e) => patch({ manualPercent: e.target.value })}
            error={manual === null}
            helperText={
              manual === null
                ? 'Zadejte procenta od 0 do 100.'
                : manualAllowedPercent !== null
                  ? `Váš limit bez schválení: ${formatPercent(manualAllowedPercent)}`
                  : 'Limit se ukáže po výběru položek.'
            }
            slotProps={{
              input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
              htmlInput: { inputMode: 'decimal', 'aria-label': 'Ruční sleva v procentech' },
            }}
            fullWidth
          />
          {manual !== null && manual > 0 && (
            <TextField
              label="Důvod slevy"
              required={overLimit}
              value={draft.manualReason}
              onChange={(e) => patch({ manualReason: e.target.value })}
              fullWidth
            />
          )}
        </Box>
      </Box>

      <TextField
        fullWidth
        multiline
        rows={2}
        label="Poznámka"
        value={draft.notes}
        onChange={(e) => patch({ notes: e.target.value })}
      />
    </Box>
  );

  const panel = draft.type === null ? null : (
    <QuotePanel quote={quote} status={status} error={error} onRetry={retry} />
  );

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullScreen={phone}
      maxWidth={desktop ? 'lg' : 'md'}
      fullWidth
      aria-labelledby="new-invoice-title"
      sx={touch ? { '& .MuiInputBase-root': { minHeight: 44 }, '& .MuiButton-root': { minHeight: 44 } } : undefined}
    >
      <DialogTitle id="new-invoice-title">Nový doklad</DialogTitle>
      <DialogContent>
        {open && (
          <Box sx={{ mb: 2 }}>
            <NumberSeriesPreview documentType="FA" />
          </Box>
        )}
        {desktop ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 3, alignItems: 'start' }}>
            <Box sx={{ display: 'grid', gap: 2.5 }}>{recipient}{details}</Box>
            <Box sx={{ position: 'sticky', top: 0 }}>{panel}</Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 2.5 }}>{recipient}{details}{panel}</Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          flexDirection: phone ? 'column' : 'row',
          alignItems: phone ? 'stretch' : 'center',
          gap: 1,
          px: 3,
          py: 2,
          ...(phone ? { borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' } : {}),
        }}
      >
        {problems.length > 0 && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', flex: phone ? undefined : 1, textAlign: phone ? 'center' : 'left' }}
          >
            {problems[0]}
          </Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            ml: phone || problems.length > 0 ? 0 : 'auto',
            ...(phone ? { '& > button:last-of-type': { flex: 1 } } : {}),
          }}
        >
          <Button variant="outlined" onClick={onClose} disabled={submitting}>Zrušit</Button>
          <Button variant="contained" onClick={() => void submit()} disabled={!ready}>
            {overLimit ? APPROVAL_LABEL : SEND_LABEL}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
