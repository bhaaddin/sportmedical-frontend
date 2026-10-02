import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Chip,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
} from '@mui/material';
import type { PartnerOrder } from '../../api/bookingContracts';

/*
 * The club schedule report (plan 9.x, club booking).
 *
 * The owner's words: "we tell the club we have these times, they say we have
 * twenty players, and the system works out six on Monday, and then writes a
 * report." That is exactly this: it takes the windows the clinic set aside and
 * the činnosti the club asked for, and turns the minutes into places and times a
 * coach can read -- "Monday 8:00-11:30, 7 places, Základní prohlídka, 8:00,
 * 8:30 …" -- with a line at the end saying whether all the players fit.
 *
 * It computes, it does not book: the places become real appointments when the
 * players register against the order's link. This is the plan the clinic hands
 * over, and the "Tisk" button opens it as a clean page to print or send.
 */

interface PlannedSlot {
  time: string; // HH:MM
  activityName: string;
}

interface WindowPlan {
  date: string;
  startTime: string;
  endTime: string;
  coveredMinutes: number;
  capacity: number;
  slots: PlannedSlot[];
}

/** "08:30:00" or "08:30" → minutes since midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

/**
 * Turns the order into a per-window plan. A queue of places to fill is built
 * from the items (each činnost × how many are still wanted), and each window is
 * filled from its start in steps of that činnost's length, up to what the
 * window's covered minutes allow. Whatever does not fit is reported, not hidden.
 */
export function planSchedule(order: PartnerOrder): {
  windows: WindowPlan[];
  totalCapacity: number;
  totalRequested: number;
  placed: number;
} {
  // The queue: one entry per place still to book, in the order the činnosti were
  // asked for. `remaining` falls back to requested − booked when absent.
  const queue: { activityName: string; durationMinutes: number }[] = [];
  for (const item of order.items) {
    const left = Math.max(0, item.requestedCount - item.bookedCount);
    for (let i = 0; i < left; i += 1) {
      queue.push({ activityName: item.activityName, durationMinutes: item.durationMinutes });
    }
  }

  // One fixed unit for the "Míst" (places) estimate across every window — the
  // order's primary činnost length. Using the NEXT queued item's length instead
  // made the capacity shift window to window and could show fewer places than the
  // slots actually generated for the same window when činnosti have mixed lengths.
  const primaryUnit = order.items[0]?.durationMinutes || 30;

  let cursor = 0;
  const windows: WindowPlan[] = [];

  for (const w of [...order.windows].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  )) {
    const start = toMinutes(w.startTime);
    let used = 0; // minutes of covered time spent so far in this window
    const slots: PlannedSlot[] = [];

    while (cursor < queue.length) {
      const next = queue[cursor];
      if (used + next.durationMinutes > w.coveredMinutes) break;
      slots.push({ time: fromMinutes(start + used), activityName: next.activityName });
      used += next.durationMinutes;
      cursor += 1;
    }

    windows.push({
      date: w.date,
      startTime: w.startTime.slice(0, 5),
      endTime: w.endTime.slice(0, 5),
      coveredMinutes: w.coveredMinutes,
      capacity: primaryUnit > 0 ? Math.floor(w.coveredMinutes / primaryUnit) : 0,
      slots,
    });
  }

  const totalRequested = order.items.reduce(
    (n, i) => n + Math.max(0, i.requestedCount - i.bookedCount),
    0,
  );
  const totalCapacity = windows.reduce((n, w) => n + w.capacity, 0);
  return { windows, totalCapacity, totalRequested, placed: cursor };
}

/**
 * Escapes text before it goes into the printable document. reportHtml builds a
 * string and hands it to document.write in the app's own origin, so an
 * unescaped club or činnost name containing markup would run there — this closes
 * that. The in-app dialog renders through React and is already safe.
 */
function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function reportHtml(order: PartnerOrder, plan: ReturnType<typeof planSchedule>): string {
  const rows = plan.windows
    .map(
      (w) => `
      <tr>
        <td>${formatDate(w.date)}</td>
        <td>${w.startTime}–${w.endTime}</td>
        <td style="text-align:center">${w.capacity}</td>
        <td>${w.slots.map((s) => s.time).join(', ') || '—'}</td>
      </tr>`,
    )
    .join('');
  const fits = plan.placed >= plan.totalRequested;
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
  <title>Rozpis – ${esc(order.partnerName)}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;color:#1a2b2b;margin:32px;}
    h1{font-size:20px;margin:0 0 4px;} .sub{color:#667;margin:0 0 16px;}
    table{border-collapse:collapse;width:100%;margin-top:12px;}
    th,td{border:1px solid #cdd;padding:6px 10px;font-size:13px;text-align:left;vertical-align:top;}
    th{background:#f0f6f6;} .tot{margin-top:16px;font-weight:600;}
    .ok{color:#0a7d5a;} .no{color:#b4531f;}
  </style></head><body>
  <h1>Rozpis vyšetření – ${esc(order.partnerName)}</h1>
  <p class="sub">${order.items.map((i) => `${esc(i.activityName)} (${i.durationMinutes} min) × ${i.requestedCount}`).join(' · ')}</p>
  <table><thead><tr><th>Den</th><th>Čas</th><th>Míst</th><th>Časy</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="tot ${fits ? 'ok' : 'no'}">
    Kapacita: ${plan.totalCapacity} míst · Požadováno: ${plan.totalRequested} hráčů ·
    ${fits ? 'Všichni se vejdou.' : `Chybí místo pro ${plan.totalRequested - plan.placed} hráčů — přidejte termín.`}
  </p>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;
}

export function ClubScheduleReport({
  order,
  open,
  onClose,
}: {
  order: PartnerOrder;
  open: boolean;
  onClose: () => void;
}) {
  const plan = planSchedule(order);
  const fits = plan.placed >= plan.totalRequested;

  const print = () => {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(reportHtml(order, plan));
    w.document.close();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Rozpis vyšetření — {order.partnerName}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          {order.items
            .map((i) => `${i.activityName} (${i.durationMinutes} min) × ${i.requestedCount}`)
            .join(' · ') || 'Žádné činnosti'}
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <MuiTable size="small">
            <TableHead>
              <TableRow>
                <TableCell>Den</TableCell>
                <TableCell>Čas</TableCell>
                <TableCell align="center">Míst</TableCell>
                <TableCell>Vygenerované časy</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.windows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: 'text.secondary' }}>
                    Zatím nejsou nastavené žádné termíny pro tento klub.
                  </TableCell>
                </TableRow>
              ) : (
                plan.windows.map((w, idx) => (
                  <TableRow key={`${w.date}-${idx}`}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(w.date)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {w.startTime}–{w.endTime}
                    </TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={w.capacity} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {w.slots.map((s) => s.time).join(', ') || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </MuiTable>
        </TableContainer>

        <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
          <Chip label={`Kapacita: ${plan.totalCapacity} míst`} />
          <Chip label={`Požadováno: ${plan.totalRequested} hráčů`} />
          <Typography variant="body2" sx={{ color: fits ? 'success.main' : 'warning.main', fontWeight: 600 }}>
            {fits
              ? 'Všichni se vejdou.'
              : `Chybí místo pro ${plan.totalRequested - plan.placed} hráčů — přidejte termín.`}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zavřít</Button>
        <Button variant="contained" onClick={print}>
          Tisk / uložit PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}
