/*
 * The header and footer every e-mail goes out in: a few plain fields on the left, a real e-mail in that frame on the
 * right, refreshed as you type. Empty fields fall back to the clinic name, the e-mail's subject and the stock sentence,
 * so a clinic that touches nothing still sends a finished e-mail.
 */
import { useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailLayoutApi } from '../../../api/emailLayout';
import type { EmailLayout } from '../../../api/emailLayout';
import { errorText } from '../../../components/booking/errorText';
import { HtmlPreview } from '../../../components/messages/HtmlPreview';
import { TARGET_SX } from '../../../ui/shelf';
import { isNotDeployed } from './messagesModel';

const LAYOUT_KEY = ['email-templates', 'layout'] as const;
const PREVIEW_DELAY_MS = 600;

export function LayoutEditor({ onToast }: { onToast: (text: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const layoutQuery = useQuery({ queryKey: LAYOUT_KEY, queryFn: emailLayoutApi.get, retry: false });
  const [draft, setDraft] = useState<EmailLayout | null>(null);

  useEffect(() => {
    if (layoutQuery.data && draft === null) setDraft(layoutQuery.data);
  }, [layoutQuery.data, draft]);

  const save = useMutation({
    mutationFn: (layout: EmailLayout) => emailLayoutApi.save(layout),
    onSuccess: (saved) => {
      setDraft(saved);
      queryClient.setQueryData(LAYOUT_KEY, saved);
      onToast('Hlavička a patička uloženy. Platí pro všechny e-maily.');
    },
  });
  const preview = useMutation({ mutationFn: (layout: EmailLayout) => emailLayoutApi.preview(layout) });
  const { mutate: refresh } = preview;

  useEffect(() => {
    if (draft === null) return undefined;
    const timer = window.setTimeout(() => refresh(draft), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, refresh]);

  if (layoutQuery.isError) {
    return isNotDeployed(layoutQuery.error)
      ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>Hlavičku a patičku půjde upravit po nasazení nové verze serveru.</Typography>
      : <Alert severity="error">{errorText(layoutQuery.error, t)}</Alert>;
  }
  if (draft === null) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám…</Typography>;

  const set = (patch: Partial<EmailLayout>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(layoutQuery.data);

  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(0,1fr)' }, alignItems: 'start' }}>
      <Stack spacing={2}>
        {save.error != null ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
        <Typography sx={{ fontWeight: 700 }}>Hlavička</Typography>
        <TextField
          label="Velký nápis nahoře"
          placeholder="Když necháte prázdné, bude tu název ordinace"
          value={draft.headerTitle}
          onChange={(e) => set({ headerTitle: e.target.value })}
          fullWidth
        />
        <TextField
          label="Menší řádek pod ním"
          placeholder="Když necháte prázdné, bude tu předmět e-mailu"
          value={draft.headerTagline}
          onChange={(e) => set({ headerTagline: e.target.value })}
          fullWidth
        />
        <TextField
          label="Logo (odkaz na obrázek)"
          placeholder="https://… (nepovinné)"
          value={draft.logoUrl}
          onChange={(e) => set({ logoUrl: e.target.value })}
          fullWidth
        />

        <Typography sx={{ fontWeight: 700, pt: 1 }}>Patička</Typography>
        <FormControlLabel
          control={<Switch checked={draft.showContacts} onChange={(e) => set({ showContacts: e.target.checked })} />}
          label="Ukázat telefon, e-mail a adresu ordinace"
          sx={{ minHeight: 44 }}
        />
        <TextField
          label="Vlastní text v patičce"
          placeholder="např. Parkování zdarma ve dvoře. Ordinační hodiny Po–Pá 7–15."
          value={draft.footerText}
          onChange={(e) => set({ footerText: e.target.value })}
          fullWidth
          multiline
          minRows={2}
        />
        <TextField
          label="Drobný text úplně dole"
          placeholder="Když necháte prázdné: Tento e-mail byl odeslán automaticky…"
          value={draft.smallPrint}
          onChange={(e) => set({ smallPrint: e.target.value })}
          fullWidth
          multiline
          minRows={2}
        />
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button disabled={!dirty} onClick={() => setDraft(layoutQuery.data ?? draft)} sx={TARGET_SX}>Zahodit změny</Button>
          <Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)} sx={TARGET_SX}>Uložit</Button>
        </Stack>
      </Stack>

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Takhle vypadá každý e-mail</Typography>
        {preview.error != null ? <Alert severity="warning" sx={{ mb: 1 }}>{errorText(preview.error, t)}</Alert> : null}
        {preview.data ? <HtmlPreview html={preview.data.bodyHtml} height={560} dark /> : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Připravuji náhled…</Typography>
        )}
      </Box>
    </Box>
  );
}
