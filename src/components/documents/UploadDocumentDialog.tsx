/*
 * Getting one document onto the server, from whatever the person in front of
 * the screen actually has.
 *
 * Three ways in, because the three situations are genuinely different:
 *
 *   scan    a sheet of paper and a camera. The usual case at a desk, and the
 *           one this exists for: no scanner, no cable, no app.
 *   file    a PDF the patient e-mailed, or a photograph already on the device.
 *   photo   the phone's own camera app, for anyone who would rather not use
 *           the scanner - `capture` opens it directly instead of the gallery.
 *
 * What it does before sending: refuses what the server would refuse, converts
 * an iPhone photo to something every browser can read, shows what is about to
 * be sent, and lets it be turned. What it does after: offers the signature,
 * because an unsigned document does not satisfy a requirement and leaving that
 * for later means the warning stays up and nobody knows why.
 */
import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, Stack, Typography,
} from '@mui/material';
import {
  Close, CloudUpload, DocumentScanner as ScannerIcon,
  PhotoCamera, RotateRight, Check,
} from '@mui/icons-material';
import DocumentScanner from '../scanner/DocumentScanner';
import { documentsApi } from '../../api/documents';
import type { DocumentTemplate, PatientDocument } from '../../api/documents';
import {
  checkFile, isHeic, isPdf, FILE_INPUT_ACCEPT, formatBytes, uploadErrorMessage,
  scanFileName, MAX_FILE_BYTES,
} from '../../services/documentFile';
import {
  heicToJpeg, loadImage, imageToCanvas, rotateCanvas, canvasToBlob,
} from '../../services/documentMedia';

export interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  template: DocumentTemplate;
  /** Fired once the server has the document, so the caller can refresh. */
  onUploaded: (document: PatientDocument) => void;
}

type Phase = 'choose' | 'preview' | 'uploading' | 'uploaded';

export default function UploadDocumentDialog({
  open, onClose, patientId, template, onUploaded,
}: UploadDocumentDialogProps) {
  const [phase, setPhase] = useState<Phase>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [uploaded, setUploaded] = useState<PatientDocument | null>(null);
  const [signing, setSigning] = useState(false);

  const fileInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
    setPhase('choose');
    setFile(null);
    setPreviewUrl(null);
    setRotation(0);
    setError(null);
    setProgress(0);
    setUploaded(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const accept = async (chosen: File) => {
    setError(null);

    const verdict = checkFile(chosen);
    if (!verdict.ok) {
      setError(verdict.message);
      return;
    }

    let prepared = chosen;
    if (isHeic(chosen)) {
      try {
        setPhase('uploading');
        setProgress(0);
        prepared = await heicToJpeg(chosen);
      } catch {
        setPhase('choose');
        setError(
          'Fotku z iPhonu se nepodařilo převést. Zkuste ji prosím poslat jako ' +
          'JPG — v nastavení fotoaparátu volbou „Nejkompatibilnější".',
        );
        return;
      }
    }

    if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
    setFile(prepared);
    setRotation(0);
    setPreviewUrl(isPdf(prepared) ? null : URL.createObjectURL(prepared));
    setPhase('preview');
  };

  const onPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    /* Cleared so choosing the same file twice fires the event again - somebody
       who rotated, disliked it and went back would otherwise get nothing. */
    event.target.value = '';
    if (chosen !== undefined) void accept(chosen);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped !== undefined) void accept(dropped);
  };

  /* Rotation is applied at send time rather than on each press, so turning a
     page four times gets back the original bytes instead of four re-encodes. */
  const fileToSend = async (): Promise<File> => {
    if (file === null) throw new Error('Není co odeslat.');
    if (rotation % 4 === 0 || isPdf(file)) return file;

    const image = await loadImage(file);
    const turned = rotateCanvas(imageToCanvas(image), rotation);
    const blob = await canvasToBlob(turned, 'image/jpeg', 0.92);
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  };

  const send = async () => {
    setPhase('uploading');
    setProgress(0);
    setError(null);
    try {
      const payload = await fileToSend();
      const document = await documentsApi.upload(
        patientId,
        template.id,
        payload,
        setProgress,
      );
      setUploaded(document);
      setPhase('uploaded');
      onUploaded(document);
    } catch (caught) {
      const status = (caught as { response?: { status?: number } })?.response?.status ?? null;
      setError(uploadErrorMessage(status));
      setPhase('preview');
    }
  };

  const sign = async () => {
    if (uploaded === null) return;
    setSigning(true);
    setError(null);
    try {
      const signed = await documentsApi.sign(uploaded.id);
      onUploaded(signed);
      close();
    } catch (caught) {
      const status = (caught as { response?: { status?: number } })?.response?.status ?? null;
      setError(uploadErrorMessage(status));
    } finally {
      setSigning(false);
    }
  };

  return (
    <>
      <Dialog open={open && !scannerOpen} onClose={close} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CloudUpload sx={{ color: '#0D7377' }} />
          {template.name}
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={close} aria-label="Zavřít"><Close /></IconButton>
        </DialogTitle>

        <DialogContent>
          {error !== null && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

          {phase === 'choose' && (
            <Stack spacing={2}>
              <Box
                onDrop={onDrop}
                onDragOver={(event) => event.preventDefault()}
                sx={{
                  border: '2px dashed', borderColor: 'divider', borderRadius: 2,
                  p: 4, textAlign: 'center', cursor: 'pointer',
                  '&:hover': { borderColor: '#0D7377', bgcolor: 'action.hover' },
                }}
                onClick={() => fileInput.current?.click()}
              >
                <CloudUpload sx={{ fontSize: 40, color: 'text.disabled' }} />
                <Typography sx={{ fontWeight: 600, mt: 1 }}>
                  Přetáhněte sem soubor nebo klikněte
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  PDF nebo fotografie (JPG, PNG, HEIC), nejvýš {formatBytes(MAX_FILE_BYTES)}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<ScannerIcon />}
                  onClick={() => setScannerOpen(true)}
                >
                  Naskenovat
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PhotoCamera />}
                  onClick={() => cameraInput.current?.click()}
                >
                  Vyfotit
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Sken najde okraje dokumentu sám, narovná ho a zmenší — z fotky
                udělá něco, co vypadá jako ze skeneru.
              </Typography>
            </Stack>
          )}

          {phase === 'preview' && file !== null && (
            <Stack spacing={2} sx={{ alignItems: 'center' }}>
              {previewUrl !== null ? (
                <Box
                  component="img"
                  src={previewUrl}
                  alt="Náhled dokumentu"
                  sx={{
                    maxWidth: '100%', maxHeight: 380, borderRadius: 1,
                    border: '1px solid', borderColor: 'divider',
                    transform: `rotate(${(rotation % 4) * 90}deg)`,
                    transition: 'transform 0.2s',
                  }}
                />
              ) : (
                <Stack spacing={1} sx={{ alignItems: 'center', py: 4 }}>
                  <CloudUpload sx={{ fontSize: 40, color: '#0D7377' }} />
                  <Typography>PDF se odešle tak, jak je.</Typography>
                </Stack>
              )}

              <Typography variant="body2" color="text.secondary">
                {file.name} · {formatBytes(file.size)}
              </Typography>

              <Stack direction="row" spacing={1}>
                {previewUrl !== null && (
                  <Button
                    startIcon={<RotateRight />}
                    onClick={() => setRotation((r) => r + 1)}
                  >
                    Otočit
                  </Button>
                )}
                <Button onClick={reset}>Vybrat jiný</Button>
              </Stack>
            </Stack>
          )}

          {phase === 'uploading' && (
            <Stack spacing={2} sx={{ py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                {progress > 0 ? 'Nahrávám dokument…' : 'Připravuji soubor…'}
              </Typography>
              <LinearProgress
                variant={progress > 0 ? 'determinate' : 'indeterminate'}
                value={progress * 100}
              />
              {progress > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {Math.round(progress * 100)} %
                </Typography>
              )}
            </Stack>
          )}

          {phase === 'uploaded' && (
            <Stack spacing={2} sx={{ py: 2 }}>
              <Alert severity="success">Dokument je nahraný.</Alert>
              <Typography variant="body2" color="text.secondary">
                Dokud není podepsaný, bere se jako nedodaný a u pacienta svítí
                upozornění, že chybí. Podepsat se dá i později.
              </Typography>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          {phase === 'preview' && (
            <>
              <Button onClick={close}>Zrušit</Button>
              <Button variant="contained" startIcon={<CloudUpload />} onClick={() => void send()}>
                Nahrát
              </Button>
            </>
          )}
          {phase === 'uploaded' && (
            <>
              <Button onClick={close}>Podepsat později</Button>
              <Button
                variant="contained"
                startIcon={<Check />}
                disabled={signing}
                onClick={() => void sign()}
              >
                {signing ? 'Podepisuji…' : 'Podepsat teď'}
              </Button>
            </>
          )}
          {phase === 'choose' && <Button onClick={close}>Zrušit</Button>}
        </DialogActions>

        <input
          ref={fileInput}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          hidden
          onChange={onPicked}
        />
        {/* `capture` sends the phone straight to its camera rather than the
            gallery - one tap fewer for the common case. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onPicked}
        />
      </Dialog>

      <DocumentScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        fileName={scanFileName(template.name)}
        title={`Naskenovat: ${template.name}`}
        onScanned={(scanned) => {
          setScannerOpen(false);
          void accept(scanned);
        }}
      />
    </>
  );
}
