/*
 * Upload: patient + session + movement + view, a clip from the phone, the client-side check, the optional 1 m marker,
 * then PUT the file (with progress) and POST process. Nothing is uploaded until the check passed (or could not run).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, LinearProgress, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CheckCircle, ErrorOutlined, Straighten, Tune, VideoCameraBack, Videocam, WbSunny, Checkroom, Style } from '@mui/icons-material';
import { PageFrame, Shelf } from '../../ui/shelf';
import { useDevice } from '../../layout/useDevice';
import {
  createClip, createSession, movementKeys, processClip, uploadClipFile, useMovementConsents, useMovementSessions,
  MOVEMENTS, VIEWS, type Movement, type View,
} from '../../api/movement';
import { MOVE_PATHS } from '../flags';
import { formatDate, useMoveT, type MoveKey } from '../i18n';
import { checkClip, type CheckVerdict, type ProbeResult } from '../lib/uploadCheck';
import { grabFrame, probeVideo } from '../lib/probeVideo';
import { PatientPicker, usePatientLabel } from '../components/PatientPicker';
import { MarkerPicker } from '../components/MarkerPicker';

const DEFAULT_VIEW: Record<Movement, View> = { running: 'side', drop_jump: 'front' };

const RECIPE: { key: string; icon: React.ReactNode }[] = [
  { key: 'quality', icon: <Videocam /> },
  { key: 'tripod', icon: <Tune /> },
  { key: 'distance', icon: <Straighten /> },
  { key: 'views', icon: <VideoCameraBack /> },
  { key: 'light', icon: <WbSunny /> },
  { key: 'clothes', icon: <Checkroom /> },
  { key: 'marker', icon: <Style /> },
];

type Phase = 'idle' | 'probing' | 'checked' | 'uploading' | 'processing';

export default function UploadPage() {
  const { t, maybe } = useMoveT();
  const device = useDevice();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patientId') ?? undefined;
  const name = usePatientLabel(patientId);
  const consents = useMovementConsents(patientId);
  const sessions = useMovementSessions(patientId);
  const careMissing = consents.data !== undefined && consents.data.find((c) => c.type === 'care')?.given !== true;

  const [movement, setMovement] = useState<Movement>('running');
  const [view, setView] = useState<View>('side');
  const [sessionChoice, setSessionChoice] = useState('new');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [verdict, setVerdict] = useState<CheckVerdict | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [frame, setFrame] = useState<{ url: string; width: number; height: number } | null>(null);
  const [markerPx, setMarkerPx] = useState<number | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  /* Kept between attempts, so a failed PUT is retried on the SAME clip and no duplicate is created. */
  const created = useRef<{ sessionId: string; clipId: string; uploadUrl: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todays = useMemo(() => (sessions.data ?? []).filter((s) => s.date === today), [sessions.data, today]);

  useEffect(() => () => { if (frame) URL.revokeObjectURL(frame.url); }, [frame]);
  useEffect(() => () => abort.current?.abort(), []);

  const choose = async (picked: File | null) => {
    created.current = null;
    setError(null);
    setVerdict(null);
    setProbe(null);
    setUnreadable(false);
    setMarkerPx(undefined);
    setFrame(null);
    setFile(picked);
    if (picked === null) { setPhase('idle'); return; }
    setPhase('probing');
    const result = await probeVideo(picked);
    if (result === null) {
      setUnreadable(true);
      setVerdict({ ok: true, rejections: [], warnings: [] });
    } else {
      setProbe(result);
      setVerdict(checkClip(result));
      if (checkClip(result).ok) setFrame(await grabFrame(picked));
    }
    setPhase('checked');
  };

  const recordAgain = () => {
    void choose(null);
    picker.current?.click();
  };

  const start = async () => {
    if (file === null || patientId === undefined) return;
    setError(null);
    abort.current = new AbortController();
    try {
      setPhase('uploading');
      setProgress(0);
      if (created.current === null) {
        let sessionId = sessionChoice;
        if (sessionChoice === 'new') {
          try {
            sessionId = (await createSession({ patientId, date: today })).id;
          } catch (e) {
            const status = (e as { response?: { status?: number } }).response?.status;
            setError(status === 403 || status === 409 || status === 412 || status === 422 ? t('upload.consent_refused') : t('upload.session_failed'));
            setPhase('checked');
            return;
          }
        }
        const clip = await createClip(sessionId, { movement, view, ...(markerPx !== undefined ? { markerPx } : {}) });
        created.current = { sessionId, ...clip };
      }
      await uploadClipFile(created.current.clipId, created.current.uploadUrl, file, setProgress, abort.current.signal);
      setPhase('processing');
      await processClip(created.current.clipId);
      void qc.invalidateQueries({ queryKey: movementKeys.sessions(patientId) });
      navigate(MOVE_PATHS.clip(created.current.clipId), { replace: true });
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError' || (e as { code?: string }).code === 'ERR_CANCELED') return;
      setError(t('upload.failed'));
      setPhase('checked');
    }
  };

  const onMarker = useCallback((px: number | undefined) => setMarkerPx(px), []);
  const busy = phase === 'uploading' || phase === 'processing';
  const canStart = patientId !== undefined && file !== null && phase === 'checked' && verdict?.ok === true && !careMissing;
  const phone = device === 'phone';

  const facts = probe
    ? probe.fps === null
      ? t('upload.facts.nofps', { w: probe.width, h: probe.height, s: String(Math.round(probe.durationS * 10) / 10).replace('.', ',') })
      : t('upload.facts', { w: probe.width, h: probe.height, fps: probe.fps, s: String(Math.round(probe.durationS * 10) / 10).replace('.', ',') })
    : null;

  const what = (
    <Shelf id="what" title={t('upload.what.title')} layout="board" stagger={false}>
      <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>{t('upload.patient')}</Typography>
          {patientId === undefined ? (
            <PatientPicker onPick={(p) => setParams({ patientId: p.id }, { replace: true })} />
          ) : (
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography data-testid="upload-patient" sx={{ fontWeight: 700 }}>{name ?? '…'}</Typography>
              <Button onClick={() => setParams({}, { replace: true })} disabled={busy} sx={{ minHeight: 44, textTransform: 'none' }}>{t('upload.patient.change')}</Button>
            </Stack>
          )}
        </Box>
        {careMissing && patientId !== undefined && (
          <Alert severity="warning" role="alert" action={<Button component={RouterLink} to={`/patients/${patientId}`} color="inherit" sx={{ minHeight: 44 }}>{t('upload.consent.open')}</Button>}>
            {t('upload.consent.missing')}
          </Alert>
        )}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>{t('upload.movement')}</Typography>
          <ToggleButtonGroup exclusive fullWidth value={movement} disabled={busy} aria-label={t('upload.movement')}
            onChange={(_, v: Movement | null) => { if (v) { setMovement(v); setView(DEFAULT_VIEW[v]); } }}>
            {MOVEMENTS.map((m) => <ToggleButton key={m} value={m} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}>{t(`movement.${m}`)}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>{t('upload.view')}</Typography>
          <ToggleButtonGroup exclusive fullWidth value={view} disabled={busy} aria-label={t('upload.view')} onChange={(_, v: View | null) => { if (v) setView(v); }}>
            {VIEWS.map((v) => <ToggleButton key={v} value={v} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 600 }}>{t(`view.${v}`)}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        {patientId !== undefined && (
          <TextField select label={t('upload.session')} value={sessionChoice} onChange={(e) => setSessionChoice(e.target.value)} disabled={busy}>
            <MenuItem value="new" sx={{ minHeight: 44 }}>{t('upload.session.new')}</MenuItem>
            {todays.map((s) => <MenuItem key={s.id} value={s.id} sx={{ minHeight: 44 }}>{formatDate(s.date)} · {s.clips.length}</MenuItem>)}
          </TextField>
        )}
      </Stack>
    </Shelf>
  );

  const fileShelf = (
    <Shelf id="file" title={t('upload.file.title')} hint={t('upload.file.hint')} layout="board" stagger={false}>
      <Stack spacing={2} sx={{ p: { xs: 1.5, md: 2 } }}>
        <input
          ref={picker}
          type="file"
          accept="video/*"
          hidden
          data-testid="clip-input"
          onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; void choose(f); }}
        />
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant={file ? 'outlined' : 'contained'} onClick={() => picker.current?.click()} disabled={busy} startIcon={<Videocam />} sx={{ minHeight: 44 }}>
            {file ? t('upload.file.change') : t('upload.file.pick')}
          </Button>
          <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0, overflowWrap: 'anywhere' }}>
            {file ? file.name : t('upload.file.none')}
          </Typography>
        </Stack>

        {phase === 'probing' && <Box role="status"><LinearProgress /><Typography variant="body2" sx={{ mt: 0.5 }}>{t('upload.probing')}</Typography></Box>}

        {verdict && !verdict.ok && (
          <Box role="alert" data-testid="upload-rejected" sx={(theme) => ({ p: 1.5, borderRadius: 2, border: `1px solid ${theme.palette.error.main}`, bgcolor: alpha(theme.palette.error.main, 0.08) })}>
            <Stack spacing={1}>
              {verdict.rejections.map((r) => (
                <Stack key={r.code} direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
                  <ErrorOutlined color="error" fontSize="small" aria-hidden sx={{ mt: 0.25 }} />
                  <Typography variant="body2">{t(`reject.${r.code}` as MoveKey, { detail: r.detail })}</Typography>
                </Stack>
              ))}
              <Box><Button variant="contained" color="error" onClick={recordAgain} sx={{ minHeight: 44 }}>{t('action.record_again')}</Button></Box>
            </Stack>
          </Box>
        )}

        {verdict?.ok && phase !== 'probing' && (
          <Stack spacing={1} data-testid="upload-ok">
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <CheckCircle color="success" fontSize="small" aria-hidden />
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{t('upload.ok')}</Typography>
            </Stack>
            {facts && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{facts}</Typography>}
            {unreadable && <Alert severity="info">{t('upload.unreadable')}</Alert>}
            {verdict.warnings.map((w) => <Alert key={w.code} severity="info">{maybe(`upload.${w.code}`, '')}</Alert>)}
          </Stack>
        )}

        {frame && phase !== 'probing' && <MarkerPicker frame={frame} onChange={onMarker} />}

        {busy && (
          <Box role="status">
            <LinearProgress variant={phase === 'uploading' ? 'determinate' : 'indeterminate'} value={Math.round(progress * 100)} aria-label={t('upload.uploading')} />
            <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="upload-progress">
              {phase === 'uploading' ? `${t('upload.uploading')} ${Math.round(progress * 100)} %` : t('upload.processing')}
            </Typography>
          </Box>
        )}
        {error && <Alert severity="error" role="alert">{error}</Alert>}

        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" size="large" onClick={() => void start()} disabled={!canStart || busy} sx={{ minHeight: 48 }}>
            {t('upload.start')}
          </Button>
          {phase === 'uploading' && <Button onClick={() => abort.current?.abort()} sx={{ minHeight: 48 }}>{t('action.cancel')}</Button>}
        </Stack>
        {patientId === undefined && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('upload.need.patient')}</Typography>}
      </Stack>
    </Shelf>
  );

  const recipe = (
    <Shelf id="recipe" title={t('recipe.title')} hint={t('recipe.hint')} layout="board" stagger={false}>
      <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: { xs: 1.5, md: 2 } }}>
        {RECIPE.map((r) => (
          <Stack component="li" key={r.key} direction="row" sx={{ gap: 1.5, alignItems: 'flex-start' }}>
            <Box aria-hidden sx={(theme) => ({ display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: 1.5, color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.12) })}>{r.icon}</Box>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t(`recipe.${r.key}` as MoveKey)}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t(`recipe.${r.key}.text` as MoveKey)}</Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Shelf>
  );

  return (
    <PageFrame title={t('title')} purpose={t('upload.purpose')}>
      <Box sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, alignItems: 'start', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(280px, 1fr)' }}>
        <Stack spacing={{ xs: 3, md: 3.5 }} sx={{ minWidth: 0 }}>{what}{fileShelf}</Stack>
        {recipe}
      </Box>
    </PageFrame>
  );
}
