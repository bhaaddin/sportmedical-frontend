/* ══════════════════════════════════════════════════════════════
   PARTNEŘI — the clubs in the marquee of the public site

   name, sport, description, web, logo; order with the arrows. A partner without a
   logo is shown as text until the file arrives. While the list is empty the public
   site shows the ten default clubs; the first partner added would replace them,
   so the empty list offers to take the defaults over first.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { TYPE } from '../../../components/settings/settingsStyle';
import { DESIGN } from '../../../theme';
import { DEFAULT_PARTNERS } from '../../../site/defaults';
import { cloudinaryWidth } from '../../../site/cloudinary';
import { siteContentAdminApi, type AdminPartner, type PartnerInput } from '../../../api/siteContentAdmin';
import type { MediaAsset } from '../../../api/media';
import { useSiteMutation } from './useSiteContentAdmin';
import type { ConfirmRequest } from './ConfirmDialog';
import { FormDialog, ListBox, ListRow, ReorderButtons, changedSort, moveItem } from './ListParts';
import { MediaUpload } from './MediaUpload';

const URL_PATTERN = /^https?:\/\/\S+\.\S+$/i;

export const partnerProblem = (name: string, url: string): { name?: string; url?: string } => {
  const problems: { name?: string; url?: string } = {};
  if (name.trim() === '') problems.name = 'Napište název partnera.';
  if (url.trim() !== '' && !URL_PATTERN.test(url.trim())) problems.url = 'Adresa webu má začínat https:// (nebo ji nechte prázdnou).';
  return problems;
};

interface SaveVars {
  id?: string;
  input: PartnerInput;
  /** The logo shown at once; `null` = none. */
  logoUrl?: string | null;
}

function PartnerDialog({ partner, open, saving, error, onClose, onSave }: {
  partner: AdminPartner | null;
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: PartnerInput, logoUrl: string | null | undefined) => void;
}) {
  const [name, setName] = useState(partner?.name ?? '');
  const [sport, setSport] = useState(partner?.sport ?? '');
  const [description, setDescription] = useState(partner?.description ?? '');
  const [url, setUrl] = useState(partner?.url ?? '');
  /** undefined = untouched, null = removed, object = a new file waiting for "Uložit". */
  const [logo, setLogo] = useState<MediaAsset | null | undefined>(undefined);
  const [attempted, setAttempted] = useState(false);

  const problems = partnerProblem(name, url);
  const shownLogo = logo === undefined ? partner?.logoUrl : logo?.url;

  const submit = () => {
    setAttempted(true);
    if (Object.keys(problems).length > 0) return;
    onSave(
      {
        name: name.trim(),
        sport: sport.trim(),
        description: description.trim(),
        url: url.trim(),
        ...(logo === undefined ? {} : { logoAssetId: logo === null ? null : logo.assetId }),
      },
      logo === undefined ? undefined : logo === null ? null : logo.url,
    );
  };

  return (
    <FormDialog
      title={partner === null ? 'Nový partner' : 'Upravit partnera'}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Uložit partnera"
      saving={saving}
    >
      {error !== null && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Název" value={name} onChange={(e) => setName(e.target.value)} required fullWidth autoFocus
        error={attempted && problems.name !== undefined} helperText={attempted ? problems.name : undefined}
        slotProps={{ input: { sx: { minHeight: 44 } } }}
      />
      <TextField label="Sport" value={sport} onChange={(e) => setSport(e.target.value)} fullWidth slotProps={{ input: { sx: { minHeight: 44 } } }} />
      <TextField label="Popis" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
      <TextField
        label="Web" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth placeholder="https://"
        error={attempted && problems.url !== undefined} helperText={attempted ? problems.url : undefined}
        slotProps={{ htmlInput: { inputMode: 'url' }, input: { sx: { minHeight: 44 } } }}
      />
      <Box>
        <Typography sx={TYPE.label}>Logo</Typography>
        {shownLogo !== undefined ? (
          <Box
            component="img"
            src={cloudinaryWidth(shownLogo, 400)}
            alt={`Logo: ${name}`}
            sx={{ display: 'block', maxHeight: 64, maxWidth: 200, objectFit: 'contain', my: 1 }}
          />
        ) : (
          <Typography sx={[TYPE.caption, { my: 1 }]}>Logo zatím chybí — zobrazí se text.</Typography>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <MediaUpload
            kind="image"
            slotKey="partners"
            forLabel={`logo partnera ${name !== '' ? name : '(nový)'}`}
            buttonLabel={shownLogo !== undefined ? 'Nahradit logo' : 'Nahrát logo'}
            onUploaded={(asset) => setLogo(asset)}
          />
          {shownLogo !== undefined && (
            <Button color="inherit" onClick={() => setLogo(null)} sx={{ minHeight: 44, color: DESIGN.danger, fontWeight: 600 }}>
              Odebrat logo
            </Button>
          )}
        </Stack>
      </Box>
    </FormDialog>
  );
}

export function PartnersSection({ partners, onConfirm }: { partners: AdminPartner[]; onConfirm: (request: ConfirmRequest) => void }) {
  const [dialog, setDialog] = useState<{ partner: AdminPartner | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useSiteMutation<SaveVars, AdminPartner | null>({
    run: ({ id, input }) => (id !== undefined ? siteContentAdminApi.updatePartner(id, input) : siteContentAdminApi.createPartner(input)),
    optimistic: (content, { id, input, logoUrl }) => {
      const patch = (base: Partial<AdminPartner>): AdminPartner => {
        const next = {
          id: base.id ?? `tmp-${Date.now()}`,
          name: input.name, sport: input.sport, description: input.description, url: input.url,
          sort: input.sort ?? base.sort ?? 0,
          ...(base.logoUrl !== undefined ? { logoUrl: base.logoUrl } : {}),
        } as AdminPartner;
        if (logoUrl === null) delete next.logoUrl;
        else if (logoUrl !== undefined) next.logoUrl = logoUrl;
        return next;
      };
      return {
        ...content,
        partners: id !== undefined
          ? content.partners.map((p) => (p.id === id ? patch(p) : p))
          : [...content.partners, patch({ sort: input.sort })],
      };
    },
    success: 'Partner uložen',
    failure: 'Partnera se nepodařilo uložit.',
    onError: setError,
    onDone: () => { setError(null); setDialog(null); },
  });

  const remove = useSiteMutation<AdminPartner>({
    run: (partner) => siteContentAdminApi.deletePartner(partner.id),
    optimistic: (content, partner) => ({ ...content, partners: content.partners.filter((p) => p.id !== partner.id) }),
    success: 'Partner smazán',
    failure: (partner) => `Partnera „${partner.name}“ se nepodařilo smazat.`,
    onError: setError,
  });

  const reorder = useSiteMutation<{ before: AdminPartner[]; after: AdminPartner[] }>({
    run: async ({ before, after }) => {
      for (const item of changedSort(before, after)) {
        await siteContentAdminApi.updatePartner(item.id, {
          name: item.name, sport: item.sport, description: item.description, url: item.url, sort: item.sort,
        });
      }
    },
    optimistic: (content, { after }) => ({ ...content, partners: after }),
    failure: 'Pořadí se nepodařilo uložit.',
    onError: setError,
  });

  const takeDefaults = useSiteMutation<void>({
    run: async () => {
      for (const item of DEFAULT_PARTNERS) {
        await siteContentAdminApi.createPartner({ name: item.name, sport: item.sport, description: item.description, url: item.url, sort: item.sort });
      }
    },
    success: 'Výchozí partneři převzati — teď je můžete upravit',
    failure: 'Výchozí seznam se nepodařilo převzít.',
    onError: setError,
  });

  const ordered = [...partners].sort((a, b) => a.sort - b.sort);
  const move = (id: string, direction: -1 | 1) => {
    setError(null);
    reorder.mutate({ before: ordered, after: moveItem(ordered, id, direction) });
  };
  const nextSort = ordered.reduce((max, p) => Math.max(max, p.sort), 0) + 1;

  return (
    <Stack spacing={2} component="section" aria-label="Partneři">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="h2" sx={TYPE.sectionTitle}>Partneři</Typography>
          <Typography sx={TYPE.caption}>Kluby a týmy, které běží v pásu partnerů na úvodní stránce webu.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setError(null); setDialog({ partner: null }); }} sx={{ minHeight: 44, fontWeight: 700 }}>
          Přidat partnera
        </Button>
      </Stack>

      {error !== null && dialog === null && <Alert severity="error">{error}</Alert>}

      {ordered.length === 0 ? (
        <Alert
          severity="info"
          action={(
            <Button color="inherit" onClick={() => takeDefaults.mutate()} disabled={takeDefaults.isPending} sx={{ minHeight: 44, fontWeight: 700 }}>
              {takeDefaults.isPending ? 'Přebírám…' : 'Převzít výchozí seznam'}
            </Button>
          )}
        >
          Zatím tu nejsou žádní partneři, web ukazuje výchozí seznam {DEFAULT_PARTNERS.length} klubů. Jakmile přidáte prvního, výchozí seznam zmizí
          — chcete-li jej zachovat a upravovat, převezměte ho.
        </Alert>
      ) : (
        <ListBox label="Seznam partnerů">
          {ordered.map((partner, index) => (
            <ListRow key={partner.id}>
              <ReorderButtons name={partner.name} index={index} count={ordered.length} onMove={(d) => move(partner.id, d)} disabled={reorder.isPending} />
              <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                <Typography sx={TYPE.itemName}>{partner.name}</Typography>
                <Typography sx={TYPE.caption}>
                  {[partner.sport, partner.url].filter((part) => part !== '').join(' · ') || 'Bez sportu a webu'}
                </Typography>
                {partner.logoUrl !== undefined ? (
                  <Box component="img" src={cloudinaryWidth(partner.logoUrl, 300)} alt={`Logo: ${partner.name}`} sx={{ display: 'block', maxHeight: 32, maxWidth: 140, objectFit: 'contain', mt: 0.5 }} />
                ) : (
                  <Typography sx={[TYPE.caption, { fontStyle: 'italic' }]}>Logo zatím chybí — zobrazí se text.</Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button color="inherit" onClick={() => { setError(null); setDialog({ partner }); }} aria-label={`Upravit partnera ${partner.name}`} sx={{ minHeight: 44, color: 'text.primary', fontWeight: 600 }}>
                  Upravit
                </Button>
                <Button
                  color="inherit"
                  aria-label={`Smazat partnera ${partner.name}`}
                  onClick={() => onConfirm({
                    title: `Smazat partnera „${partner.name}“?`,
                    body: 'Partner zmizí z webu. Tuto změnu nelze vrátit.',
                    confirmLabel: 'Ano, smazat',
                    onConfirm: () => { setError(null); remove.mutate(partner); },
                  })}
                  sx={{ minHeight: 44, color: DESIGN.danger, fontWeight: 600 }}
                >
                  Smazat
                </Button>
              </Stack>
            </ListRow>
          ))}
        </ListBox>
      )}

      {dialog !== null && (
        <PartnerDialog
          key={dialog.partner?.id ?? 'new'}
          partner={dialog.partner}
          open
          saving={save.isPending}
          error={error}
          onClose={() => { setDialog(null); setError(null); }}
          onSave={(input, logoUrl) => {
            setError(null);
            save.mutate({
              id: dialog.partner?.id,
              input: { ...input, sort: dialog.partner?.sort ?? nextSort },
              logoUrl,
            });
          }}
        />
      )}
    </Stack>
  );
}
