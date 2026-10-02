/* ══════════════════════════════════════════════════════════════
   CO SMÍ TENTO ČLOVĚK

   ── Why this exists ──

   The owner's rule: "Administrátor musí mít možnost pro každého zaměstnance
   nastavit co může vidět, co může upravovat, ke kterým kalendářům má přístup,
   zda může vytvářet rezervace, zda může upravovat rezervace, zda může rušit
   rezervace, zda může pracovat s dotazníky, zda může měnit nastavení."

   What existed was a switch over three roles in the source. Every receptionist
   had exactly the same powers as every other receptionist, for ever, and the
   only way to give one of them something extra was to make her an
   administrator — which gave her everything.

   ── Three states, not two ──

   A permission is on because the role gives it, on because somebody switched
   it on, or off because somebody switched it off. "Podle role" is the third
   state and the important one: it means this person keeps following the role
   when its defaults change. A screen with only on and off would silently
   freeze everybody on today's defaults the first time anybody touched it.
   ══════════════════════════════════════════════════════════════ */

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PERMISSION_LABELS, userPermissionsApi } from '../../api/userPermissions';
import type { UserPermissionState } from '../../api/userPermissions';
import { errorText } from '../booking/errorText';

interface Props {
  userId: string | null;
  userName: string;
  /** Owners are not adjustable — see the note on the empty state. */
  isOwner: boolean;
  onClose: () => void;
}

/** What the three buttons mean, as one value. */
type Choice = 'role' | 'on' | 'off';

const choiceOf = (state: UserPermissionState): Choice =>
  !state.isOverridden ? 'role' : state.effective ? 'on' : 'off';

export function UserPermissionsDialog({ userId, userName, isOwner, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const permissions = useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: () => userPermissionsApi.list(userId!),
    enabled: userId !== null && !isOwner,
  });

  const save = useMutation({
    mutationFn: ({ permission, granted }: { permission: string; granted: boolean | null }) =>
      userPermissionsApi.set(userId!, permission, granted),
    onSuccess: (fresh) => queryClient.setQueryData(['user-permissions', userId], fresh),
  });

  const rows = permissions.data ?? [];

  return (
    <Dialog open={userId !== null} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 800 }}>
        Co smí {userName}
      </DialogTitle>

      <DialogContent dividers>
        {isOwner && (
          <Alert severity="info">
            Majitel má vždy všechna práva. Kdyby si je mohl odebrat, nezbyl by
            nikdo, kdo mu je vrátí.
          </Alert>
        )}

        {!isOwner && permissions.isPending && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 2 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Načítáme práva…</Typography>
          </Box>
        )}

        {!isOwner && permissions.isError && (
          <Alert severity="error">{errorText(permissions.error, t)}</Alert>
        )}

        {save.error !== null && (
          <Alert severity="error" sx={{ mb: 2 }}>{errorText(save.error, t)}</Alert>
        )}

        {!isOwner && !permissions.isPending && rows.length === 0 && !permissions.isError && (
          <Typography variant="body2" color="text.secondary">
            Nedostali jsme žádná práva k zobrazení. Zkuste dialog otevřít znovu.
          </Typography>
        )}

        <Stack spacing={1.5} sx={{ mt: isOwner ? 2 : 0 }}>
          {rows.map((row) => {
            const wording = PERMISSION_LABELS[row.permission];

            return (
              <Box
                key={row.permission}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                  py: 1,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {/* An unknown name still shows: better a dotted identifier
                          than a row that quietly disappears. */}
                      {wording?.label ?? row.permission}
                    </Typography>
                    {row.isOverridden && (
                      <Chip size="small" color="warning" label="Nastaveno ručně" />
                    )}
                  </Box>
                  {wording !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                      {wording.detail}
                    </Typography>
                  )}
                </Box>

                <ToggleButtonGroup
                  size="small"
                  exclusive
                  disabled={save.isPending}
                  value={choiceOf(row)}
                  onChange={(_, next: Choice | null) => {
                    // null is the group telling us the same button was pressed
                    // again. Nothing changed, so nothing is sent.
                    if (next === null) return;

                    save.mutate({
                      permission: row.permission,
                      granted: next === 'role' ? null : next === 'on',
                    });
                  }}
                >
                  <ToggleButton value="off" aria-label={`Zakázat: ${wording?.label ?? row.permission}`}>
                    Ne
                  </ToggleButton>
                  <ToggleButton value="role" aria-label={`Podle role: ${wording?.label ?? row.permission}`}>
                    Podle role{row.fromRole ? ' (ano)' : ' (ne)'}
                  </ToggleButton>
                  <ToggleButton value="on" aria-label={`Povolit: ${wording?.label ?? row.permission}`}>
                    Ano
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          Změny se ukládají hned. Kdo co změnil, je v auditním logu.
        </Typography>
        <Button onClick={onClose} variant="contained">Hotovo</Button>
      </DialogActions>
    </Dialog>
  );
}
