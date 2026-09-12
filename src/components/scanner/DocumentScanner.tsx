/*
 * The scanner: point a camera at a sheet of paper and get back a flat, legible
 * page - what Adobe Scan does, in a browser, with nothing to install.
 *
 * Four ideas, in the order they matter:
 *
 * 1. The preview shows what it has found, live. A frame appearing around the
 *    page tells somebody they are holding it right, and its absence tells them
 *    to move - without a word of instruction.
 * 2. It waits for the page to be still. Pressing a shutter shakes a phone; the
 *    steadiest moment is the one just before anybody touches it.
 * 3. The corners can be dragged afterwards. Detection is right most of the
 *    time, and the times it is wrong are exactly the times somebody needs the
 *    scan - a form on a patterned desk, a page in poor light.
 * 4. Nothing is final until it is accepted. Rotate, re-filter, redo a page,
 *    drop it. A scan that cannot be undone gets sent wrong rather than redone.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack,
  ToggleButton, ToggleButtonGroup, Typography, CircularProgress, Alert, Chip,
} from '@mui/material';
import {
  CameraAlt, Close, RotateRight, Check, Delete, AddAPhoto, Replay, Crop,
} from '@mui/icons-material';
import { ScannerClient } from './scannerClient';
import type { ScanFilter } from './detect';
import type { Quad, Point } from './geometry';
import {
  openCamera, stopCamera, cameraErrorMessage, rotateCanvas, pagesToPdf,
} from '../../services/documentMedia';

/** Detection on the live preview - several times a second, not every frame. */
const PREVIEW_INTERVAL_MS = 160;
/** How many still frames before the shutter fires itself. */
const STEADY_FRAMES_REQUIRED = 5;
/** How far a corner may drift between frames and still count as still, in pixels. */
const STEADY_TOLERANCE = 14;

interface ScannedPage {
  canvas: HTMLCanvasElement;
  rotation: number;
}

type Stage = 'preparing' | 'camera' | 'adjust' | 'review';

export interface DocumentScannerProps {
  open: boolean;
  onClose: () => void;
  /** The finished document. One PDF, however many pages. */
  onScanned: (file: File) => void;
  fileName: string;
  title?: string;
}

const quadDrift = (a: Quad, b: Quad): number =>
  Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));

export default function DocumentScanner({
  open, onClose, onScanned, fileName, title = 'Naskenovat dokument',
}: DocumentScannerProps) {
  const [stage, setStage] = useState<Stage>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [filter, setFilter] = useState<ScanFilter>('text');
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState(false);
  const [adjustQuad, setAdjustQuad] = useState<Quad | null>(null);

  const scannerRef = useRef<ScannerClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLCanvasElement | null>(null);
  const pageRef = useRef<HTMLCanvasElement | null>(null);

  /* Refs, not state: the detection loop reads these many times a second, and
     re-rendering on every frame makes the preview stutter. */
  const lastQuad = useRef<Quad | null>(null);
  const steadyCount = useRef(0);
  const capturedFrame = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef<number | null>(null);

  const shutdown = useCallback(() => {
    stopCamera(streamRef.current);
    streamRef.current = null;
    lastQuad.current = null;
    steadyCount.current = 0;
  }, []);

  /* The worker holds eleven megabytes; it goes when the dialog does. */
  const disposeScanner = useCallback(() => {
    scannerRef.current?.dispose();
    scannerRef.current = null;
  }, []);

  const close = useCallback(() => {
    shutdown();
    disposeScanner();
    setPages([]);
    setStage('preparing');
    setError(null);
    onClose();
  }, [onClose, shutdown, disposeScanner]);

  /* Load OpenCV, then open the camera, so the first frame has something to
     look at rather than being dropped. */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      setStage('preparing');
      setError(null);
      try {
        /* Both slow things at once: the eleven megabytes start loading on the
           worker while the camera permission prompt is still on screen. */
        const scanner = new ScannerClient();
        scannerRef.current = scanner;
        const warming = scanner.warmup();
        const stream = await openCamera();
        await warming;
        if (cancelled) {
          stopCamera(stream);
          return;
        }
        streamRef.current = stream;
        if (videoRef.current !== null) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStage('camera');
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof Error && caught.message.includes('OpenCV')
            ? 'Sken se nepodařilo připravit. Zkuste to prosím znovu, nebo nahrajte soubor.'
            : cameraErrorMessage(caught),
        );
      }
    })();

    return () => {
      cancelled = true;
      shutdown();
      disposeScanner();
    };
  }, [open, shutdown, disposeScanner]);

  const captureFrom = useCallback(async (quad: Quad | null) => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (video === null || scanner === null) return;

    const frame = document.createElement('canvas');
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    const frameCtx = frame.getContext('2d', { willReadFrequently: true });
    frameCtx?.drawImage(video, 0, 0);
    capturedFrame.current = frame;

    let found = quad;
    if (found === null && frameCtx !== null) {
      found = await scanner.detect(frameCtx.getImageData(0, 0, frame.width, frame.height));
    }

    /* No detection is not a dead end: an outline inset from the edges is
       offered, and the corners are draggable. */
    setAdjustQuad(
      found ?? [
        { x: frame.width * 0.1, y: frame.height * 0.1 },
        { x: frame.width * 0.9, y: frame.height * 0.1 },
        { x: frame.width * 0.9, y: frame.height * 0.9 },
        { x: frame.width * 0.1, y: frame.height * 0.9 },
      ],
    );
    shutdown();
    setStage('adjust');
  }, [shutdown]);

  /* The live loop: find the page, draw the outline, fire once it stops moving. */
  useEffect(() => {
    if (stage !== 'camera') return;
    let timer = 0;

    const tick = async () => {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const scanner = scannerRef.current;
      const scratch = frameRef.current;

      if (video === null || overlay === null || scanner === null || scratch === null ||
          video.videoWidth === 0) {
        timer = window.setTimeout(() => void tick(), PREVIEW_INTERVAL_MS);
        return;
      }

      scratch.width = video.videoWidth;
      scratch.height = video.videoHeight;
      const ctxScratch = scratch.getContext('2d', { willReadFrequently: true });
      ctxScratch?.drawImage(video, 0, 0);

      const quad: Quad | null =
        ctxScratch === null
          ? null
          : await scanner.detect(ctxScratch.getImageData(0, 0, scratch.width, scratch.height));

      overlay.width = video.clientWidth;
      overlay.height = video.clientHeight;
      const ctx = overlay.getContext('2d');
      if (ctx !== null) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        if (quad !== null) {
          const sx = overlay.width / scratch.width;
          const sy = overlay.height / scratch.height;
          ctx.beginPath();
          quad.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x * sx, p.y * sy);
            else ctx.lineTo(p.x * sx, p.y * sy);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(13,115,119,0.16)';
          ctx.fill();
          ctx.strokeStyle = '#0D7377';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      setDetected(quad !== null);

      if (quad !== null && lastQuad.current !== null &&
          quadDrift(quad, lastQuad.current) < STEADY_TOLERANCE) {
        steadyCount.current += 1;
      } else {
        steadyCount.current = 0;
      }
      lastQuad.current = quad;

      if (steadyCount.current >= STEADY_FRAMES_REQUIRED && quad !== null) {
        void captureFrom(quad);
        return;
      }

      timer = window.setTimeout(() => void tick(), PREVIEW_INTERVAL_MS);
    };

    timer = window.setTimeout(() => void tick(), PREVIEW_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [stage, captureFrom]);

  /* The adjustable outline, with handles big enough for a fingertip. */
  useEffect(() => {
    if (stage !== 'adjust' || adjustQuad === null) return;
    const frame = capturedFrame.current;
    const canvas = pageRef.current;
    if (frame === null || canvas === null) return;

    const scale = Math.min(1, 520 / frame.width);
    canvas.width = frame.width * scale;
    canvas.height = frame.height * scale;

    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    adjustQuad.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x * scale, p.y * scale);
      else ctx.lineTo(p.x * scale, p.y * scale);
    });
    ctx.closePath();
    ctx.strokeStyle = '#0D7377';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const p of adjustQuad) {
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#0D7377';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [stage, adjustQuad]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = pageRef.current;
    const frame = capturedFrame.current;
    if (canvas === null || frame === null || canvas.width === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const toFrame = frame.width / canvas.width;
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width) * toFrame,
      y: (event.clientY - rect.top) * (canvas.height / rect.height) * toFrame,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (adjustQuad === null) return;
    const point = pointFromEvent(event);
    if (point === null) return;
    let nearest = 0;
    let best = Infinity;
    adjustQuad.forEach((p, i) => {
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    dragging.current = nearest;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging.current === null || adjustQuad === null) return;
    const point = pointFromEvent(event);
    const frame = capturedFrame.current;
    if (point === null || frame === null) return;
    const next = [...adjustQuad] as Quad;
    next[dragging.current] = {
      x: Math.max(0, Math.min(frame.width, point.x)),
      y: Math.max(0, Math.min(frame.height, point.y)),
    };
    setAdjustQuad(next);
  };

  const onPointerUp = () => {
    dragging.current = null;
  };

  const acceptPage = async () => {
    const scanner = scannerRef.current;
    const frame = capturedFrame.current;
    if (scanner === null || frame === null || adjustQuad === null) return;

    const ctx = frame.getContext('2d', { willReadFrequently: true });
    if (ctx === null) return;

    setError(null);
    try {
      const finished = await scanner.flatten(
        ctx.getImageData(0, 0, frame.width, frame.height),
        adjustQuad,
        filter,
      );
      const flat = document.createElement('canvas');
      flat.width = finished.width;
      flat.height = finished.height;
      flat.getContext('2d')?.putImageData(finished, 0, 0);
      setPages((current) => [...current, { canvas: flat, rotation: 0 }]);
      setStage('review');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stránku se nepodařilo zpracovat.');
    }
  };

  const restartCamera = async () => {
    setError(null);
    setStage('preparing');
    try {
      const stream = await openCamera();
      streamRef.current = stream;
      if (videoRef.current !== null) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      steadyCount.current = 0;
      lastQuad.current = null;
      setStage('camera');
    } catch (caught) {
      setError(cameraErrorMessage(caught));
      setStage('review');
    }
  };

  const rotatePage = (index: number) =>
    setPages((current) =>
      current.map((p, i) => (i === index ? { ...p, rotation: p.rotation + 1 } : p)),
    );

  const removePage = (index: number) =>
    setPages((current) => current.filter((_, i) => i !== index));

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const rendered = pages.map((p) => rotateCanvas(p.canvas, p.rotation));
      const pdf = await pagesToPdf(rendered);
      onScanned(new File([pdf], fileName, { type: 'application/pdf' }));
      close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dokument se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  };

  const pageWord = (n: number) => (n === 1 ? 'strana' : n < 5 ? 'strany' : 'stran');

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CameraAlt sx={{ color: '#0D7377' }} />
        {title}
        {pages.length > 0 && (
          <Chip size="small" label={`${pages.length} ${pageWord(pages.length)}`} />
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={close} aria-label="Zavřít"><Close /></IconButton>
      </DialogTitle>

      <DialogContent>
        {error !== null && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {stage === 'preparing' && error === null && (
          <Stack spacing={2} sx={{ py: 6, alignItems: 'center' }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Připravujeme sken — chvilku to trvá, ale jen poprvé.
            </Typography>
          </Stack>
        )}

        <Box sx={{ position: 'relative', display: stage === 'camera' ? 'block' : 'none' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', borderRadius: 8, background: '#000' }}
          />
          <canvas
            ref={overlayRef}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none',
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            {detected
              ? 'Držte chvilku klidně — vyfotíme to sami.'
              : 'Položte dokument na kontrastní podklad a namiřte na něj.'}
          </Typography>
          <Stack direction="row" sx={{ mt: 1, justifyContent: 'center' }}>
            <Button variant="outlined" startIcon={<CameraAlt />} onClick={() => void captureFrom(null)}>
              Vyfotit teď
            </Button>
          </Stack>
        </Box>

        {stage === 'adjust' && (
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Zkontrolujte rohy — dají se posunout prstem nebo myší.
            </Typography>
            <canvas
              ref={pageRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ maxWidth: '100%', touchAction: 'none', borderRadius: 8, cursor: 'grab' }}
            />
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filter}
              onChange={(_, value) => {
                if (value !== null) setFilter(value as ScanFilter);
              }}
            >
              <ToggleButton value="text">Text</ToggleButton>
              <ToggleButton value="grey">Odstíny šedi</ToggleButton>
              <ToggleButton value="colour">Barevně</ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={1}>
              <Button startIcon={<Replay />} onClick={() => void restartCamera()}>
                Vyfotit znovu
              </Button>
              <Button variant="contained" startIcon={<Crop />} onClick={() => void acceptPage()}>
                Oříznout a použít
              </Button>
            </Stack>
          </Stack>
        )}

        {stage === 'review' && (
          <Stack spacing={2}>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
              {pages.map((page, index) => (
                <Box key={index} sx={{ width: 150 }}>
                  <Box
                    component="img"
                    src={rotateCanvas(page.canvas, page.rotation).toDataURL('image/jpeg', 0.7)}
                    alt={`Strana ${index + 1}`}
                    sx={{
                      width: '100%', borderRadius: 1,
                      border: '1px solid', borderColor: 'divider',
                    }}
                  />
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption">Strana {index + 1}</Typography>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => rotatePage(index)}
                        aria-label={`Otočit stranu ${index + 1}`}
                      >
                        <RotateRight fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => removePage(index)}
                        aria-label={`Smazat stranu ${index + 1}`}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <Button startIcon={<AddAPhoto />} onClick={() => void restartCamera()}>
                Přidat další stranu
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Check />}
                disabled={saving || pages.length === 0}
                onClick={() => void finish()}
              >
                {saving ? 'Ukládám…' : 'Hotovo'}
              </Button>
            </Stack>
          </Stack>
        )}

        {/* Scratch surface for detection; never shown. */}
        <canvas ref={frameRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
}
