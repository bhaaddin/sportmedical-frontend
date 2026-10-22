/*
 * R4 - what the desk reads when the server refuses with `worker.busy`: the clashing booking named in plain Czech (calendar, činnost,
 * time - never a patient) and, for an owner or an administrator (`settings.clinic.manage`), the override with a reason.
 *
 *   `WorkerBusyNotice`  the panel inside a dialog that is already open (the booking dialog)
 *   `WorkerBusyDialog`  the same panel in a dialog of its own (a drag that the server refused)
 *
 * The override is not an ordinary button: it is set apart, it needs a reason somebody typed, and it exists only when the server said
 * the refusal is overridable. Anybody else is told to ask the owner - the server refuses an override from them with
 * `403 worker.busy.override_forbidden`, which the caller passes in as `forbidden`.
 */
import { useState } from 'react';
import { Alert, AlertTitle, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { usePermission } from '../../auth/usePermission';
import { WORKER_BUSY_TEXT, workerBusyMessage, type WorkerBusy } from '../../api/workerBusy';

export interface WorkerBusyNoticeProps {
  busy: WorkerBusy;
  /** Retry with the override reason; the caller closes the notice when it succeeds. */
  onOverride: (reason: string) => void;
  /** The retry is running. */
  working?: boolean;
  /** The server refused the override itself (`worker.busy.override_forbidden`). */
  forbidden?: boolean;
  onClose?: () => void;
}

export function WorkerBusyNotice({ busy, onOverride, working = false, forbidden = false, onClose }: WorkerBusyNoticeProps) {
  const mayOverride = usePermission('settings.clinic.manage');
  const [reason, setReason] = useState('');
  const canOverride = busy.overridable && mayOverride && !forbidden;
  return (
    <Alert severity="warning" data-testid="worker-busy" {...(onClose ? { onClose } : {})} sx={{ alignItems: 'flex-start' }}>
      <AlertTitle>{WORKER_BUSY_TEXT.title}</AlertTitle>
      <Typography variant="body2" data-testid="worker-busy-message">{workerBusyMessage(busy)}</Typography>
      {forbidden ? (
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }} data-testid="worker-busy-forbidden">{WORKER_BUSY_TEXT.forbidden}</Typography>
      ) : null}
      {canOverride ? (
        <Stack spacing={1} sx={{ mt: 1.5 }} data-testid="worker-busy-override">
          <Typography variant="caption" color="text.secondary">{WORKER_BUSY_TEXT.overrideHint}</Typography>
          <TextField size="small" label={WORKER_BUSY_TEXT.overrideReason} value={reason} onChange={(e) => setReason(e.target.value)} fullWidth />
          <div>
            <Button size="small" color="warning" variant="contained" disabled={working || reason.trim() === ''} onClick={() => onOverride(reason.trim())} sx={{ minHeight: 44 }}>
              {WORKER_BUSY_TEXT.override}
            </Button>
          </div>
        </Stack>
      ) : busy.overridable && !mayOverride ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>{WORKER_BUSY_TEXT.forbidden}</Typography>
      ) : null}
    </Alert>
  );
}

export function WorkerBusyDialog({ busy, onOverride, onClose, working = false, forbidden = false, title }: WorkerBusyNoticeProps & { title: string }) {
  return (
    <Dialog open onClose={onClose ?? (() => undefined)} fullWidth maxWidth="sm" data-testid="worker-busy-dialog">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <WorkerBusyNotice busy={busy} onOverride={onOverride} working={working} forbidden={forbidden} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>Zavřít</Button>
      </DialogActions>
    </Dialog>
  );
}
