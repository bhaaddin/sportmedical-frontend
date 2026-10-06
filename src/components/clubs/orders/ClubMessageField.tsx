/*
 * "Zpráva pro klub (zobrazí se v portálu klubu)": the optional note a desk change can carry to the club's portal.
 * Multi-line, a counter and the standing hint that the change itself reaches the portal automatically. The parent
 * sends it as `clubMessage` only when something was typed (`clubMessageOf`).
 */
import { TextField } from '@mui/material';

export const CLUB_MESSAGE_MAX = 500;
export const CLUB_MESSAGE_LABEL = 'Zpráva pro klub (zobrazí se v portálu klubu)';
export const CLUB_MESSAGE_HINT = 'Klub uvidí tuto změnu v portálu automaticky.';

/** The trimmed message, or undefined when nothing (but blanks) was typed: nothing is sent then. */
export const clubMessageOf = (value: string): string | undefined => {
  const text = value.trim();
  return text === '' ? undefined : text.slice(0, CLUB_MESSAGE_MAX);
};

export function ClubMessageField({ value, onChange, disabled = false, label = CLUB_MESSAGE_LABEL, hint = CLUB_MESSAGE_HINT, testId = 'club-message' }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  testId?: string;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, CLUB_MESSAGE_MAX))}
      multiline
      minRows={2}
      maxRows={6}
      fullWidth
      disabled={disabled}
      data-testid={testId}
      helperText={(
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>{hint}</span>
          <span data-testid={`${testId}-counter`} aria-live="off">{`${value.length}/${CLUB_MESSAGE_MAX}`}</span>
        </span>
      )}
      slotProps={{ htmlInput: { maxLength: CLUB_MESSAGE_MAX } }}
    />
  );
}

export default ClubMessageField;
