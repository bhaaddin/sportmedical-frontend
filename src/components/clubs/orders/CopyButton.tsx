/*
 * The copy button every club link has beside it: one click copies `text`, the label turns into "Zkopírováno" for
 * two seconds (also announced to screen readers), "Nepodařilo se" when the browser refused. Colours come from the
 * MUI theme, so it reads in both modes and every accent; 44 px high.
 */
import { Button } from '@mui/material';
import { Check, ContentCopy } from '@mui/icons-material';
import { useCopyFeedback } from './clipboard';

export function CopyButton({ text, label = 'Zkopírovat', ariaLabel, disabled = false, testId, onCopied, sx }: {
  text: string;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  testId?: string;
  onCopied?: (ok: boolean) => void;
  sx?: object;
}) {
  const { state, copy } = useCopyFeedback();
  const text_ = state === 'copied' ? 'Zkopírováno' : state === 'failed' ? 'Nepodařilo se zkopírovat' : label;
  return (
    <Button
      type="button"
      variant="contained"
      color={state === 'failed' ? 'error' : state === 'copied' ? 'success' : 'primary'}
      startIcon={state === 'copied' ? <Check /> : <ContentCopy />}
      disabled={disabled || text === ''}
      onClick={() => { void copy(text).then((ok) => onCopied?.(ok)); }}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
      data-copy-state={state}
      sx={{ minHeight: 44, minWidth: 44, flexShrink: 0, whiteSpace: 'nowrap', ...sx }}
    >
      <span aria-live="polite">{text_}</span>
    </Button>
  );
}
