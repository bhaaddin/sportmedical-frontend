/* ══════════════════════════════════════════════════════════════
   THE "NAHRÁT" CONTROL

   One button + hidden file input, shared by a media slot and a partner logo.
   It checks the file in the browser (type, size) and says why in a sentence,
   shows the upload's progress, and turns every failure into words on the page -
   the 503 "Úložiště médií není nastavené" additionally links to the screen where
   the storage is set up.
   ══════════════════════════════════════════════════════════════ */

import { useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import {
  acceptFor, deleteMedia, mediaFailureOf, uploadMedia, validateMediaFile,
  type MediaAsset, type MediaFailure, type MediaKind,
} from '../../../api/media';

export const MEDIA_STORAGE_PATH = '/nastaveni/uloziste-medii';

export function UploadFailure({ failure }: { failure: MediaFailure }) {
  return (
    <Alert severity="error" role="alert" sx={{ alignItems: 'center' }}>
      {failure.message}
      {failure.kind === 'notConfigured' && (
        <>
          {' '}
          <Box component={RouterLink} to={MEDIA_STORAGE_PATH} sx={{ color: 'inherit', fontWeight: 700, display: 'inline-block', py: 1 }}>
            Nastavit úložiště médií
          </Box>
        </>
      )}
    </Alert>
  );
}

export interface MediaUploadProps {
  kind: MediaKind;
  /** Passed to the server so it can file the asset. */
  slotKey?: string;
  /** Accessible name of the file input — who it is for ("Hero — fotka 1 z 3"). */
  forLabel: string;
  buttonLabel: string;
  /** Called with the stored asset; may throw to say the asset could not be put in its place. */
  onUploaded: (asset: MediaAsset) => Promise<void> | void;
  disabled?: boolean;
  variant?: 'contained' | 'outlined';
}

export function MediaUpload({ kind, slotKey, forLabel, buttonLabel, onUploaded, disabled = false, variant = 'outlined' }: MediaUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<MediaFailure | null>(null);
  const busy = progress !== null;

  const pick = async (file: File | undefined) => {
    if (file === undefined) return;
    const problem = validateMediaFile(file, kind);
    if (problem !== null) {
      setFailure({ kind: 'invalid', message: problem });
      return;
    }
    setFailure(null);
    setProgress(0);
    let asset: MediaAsset | null = null;
    try {
      asset = await uploadMedia(file, { slotKey, onProgress: setProgress });
      await onUploaded(asset);
    } catch (error) {
      if (asset !== null) {
        // The file is stored but could not be put in its place: do not leave an orphan in the storage.
        void deleteMedia(asset.assetId).catch(() => undefined);
        setFailure({ kind: 'other', message: 'Soubor se nahrál, ale nepodařilo se ho vložit na jeho místo. Zkuste to prosím znovu.' });
      } else {
        setFailure(mediaFailureOf(error));
      }
    } finally {
      setProgress(null);
      if (input.current !== null) input.current.value = '';
    }
  };

  return (
    <Box>
      <Button
        component="label"
        role={undefined}
        tabIndex={-1}
        variant={variant}
        color={variant === 'outlined' ? 'inherit' : 'primary'}
        disabled={disabled || busy}
        startIcon={<UploadIcon />}
        sx={{
          minHeight: 44,
          fontWeight: 600,
          ...(variant === 'outlined' ? { color: 'text.primary' } : {}),
          '&:focus-within': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        {busy ? 'Nahrávám…' : buttonLabel}
        <Box
          component="input"
          ref={input}
          type="file"
          accept={acceptFor(kind)}
          aria-label={`Soubor pro ${forLabel}`}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => void pick(event.target.files?.[0])}
          sx={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
        />
      </Button>
      {busy && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress variant="determinate" value={progress ?? 0} aria-label={`Nahrávání: ${forLabel}`} sx={{ height: 8, borderRadius: 4 }} />
          <Typography sx={{ fontSize: 13, mt: 0.5 }}>Nahrávám… {progress ?? 0}&nbsp;%</Typography>
        </Box>
      )}
      {failure !== null && !busy && (
        <Box sx={{ mt: 1 }}>
          <UploadFailure failure={failure} />
        </Box>
      )}
    </Box>
  );
}
