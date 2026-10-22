/*
 * Draws an export / download button for the person who may press it, and the same button switched off, with the
 * reason on hover, focus and touch ("Stahování povoluje administrátor."), for the person who may not (R14f).
 *
 *   <ExportGate>{(blocked) => <Button disabled={blocked} onClick={...}>Stáhnout</Button>}</ExportGate>
 *
 * It only hides a button that would be refused; the refusal itself is the server's. `extraDisabled` lets a button keep
 * its own reason for being off (nothing to export) without showing the permission reason for it.
 */
import type { ReactElement } from 'react';
import { Box, Tooltip } from '@mui/material';
import { useExportAccess } from '../../auth/useExportAccess';

export function ExportGate({ children }: { children: (blocked: boolean) => ReactElement }) {
  const access = useExportAccess();
  if (access.allowed) return children(false);

  return (
    <Tooltip title={access.reason ?? ''} enterTouchDelay={0} leaveTouchDelay={4000}>
      {/* A disabled button swallows pointer events; the wrapper is what the hover and the long press land on. */}
      <Box component="span" tabIndex={0} role="group" aria-label={access.reason ?? undefined} data-testid="export-blocked" sx={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', cursor: 'not-allowed', '& button': { opacity: 0.45 } }}>
        {children(true)}
      </Box>
    </Tooltip>
  );
}

export default ExportGate;
