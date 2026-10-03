/* ══════════════════════════════════════════════════════════════
   MÉDIA A TEXTY  (route: /nastaveni/media-a-texty)

   The one screen where staff change what the public website says and shows,
   without a developer: photos, videos, sentences, the partners and the FAQ.

     left / top     the pages of the site (from the slot registry, src/site/siteSlots.ts)
                    with "vyplněno / celkem" and a search
     content        the slots of the chosen page as cards: preview or grey placeholder
                    ("Sem patří fotka — doporučeno 1600 × 900 px"), Nahrát, Odstranit,
                    alt text, the text editor with its default and "Vrátit výchozí"
     Partneři, Časté otázky   lists with add / edit / delete / order

   Texts and alt texts are drafts until "Uložit" (the frame's button saves all of
   them, a card's own button saves that card). Uploading, removing, resetting, and
   everything about partners and the FAQ act at once, optimistically, and roll back
   with a visible sentence when the server refuses. Leaving with unsaved drafts asks.

   Three layouts: phone = one column with a scrolling row of page chips and the
   frame's pinned save bar; tablet = page list + one column of cards; desktop = page
   list + two columns of cards.
   ══════════════════════════════════════════════════════════════ */

import { useDeferredValue, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, ButtonBase, InputAdornment, Link, Stack, TextField, Typography, Button } from '@mui/material';
import { Collections as MediaIcon, OpenInNew as OpenIcon, Search as SearchIcon } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FilterChips } from '../../components/ui';
import { TYPE, focusRing, settingsHover, settingsLine, settingsSelected } from '../../components/settings/settingsStyle';
import { useDevice } from '../../layout/useDevice';
import { slotDef } from '../../site/siteSlots';
import type { SlotDef } from '../../site/slotTypes';
import {
  ADMIN_SITE_CONTENT_KEY, siteContentAdminApi, type AdminSiteContent, type AdminSlot, type SlotUpdate,
} from '../../api/siteContentAdmin';
import type { MediaAsset } from '../../api/media';
import { SettingsScreen } from './SettingsFrame';
import { SlotCard } from './siteContent/SlotCard';
import { PartnersSection } from './siteContent/PartnersSection';
import { FaqSection } from './siteContent/FaqSection';
import { ConfirmDialog, type ConfirmRequest } from './siteContent/ConfirmDialog';
import { MEDIA_STORAGE_PATH } from './siteContent/MediaUpload';
import { useAdminSiteContent, useSiteMutation } from './siteContent/useSiteContentAdmin';
import { useUnsavedGuard } from './siteContent/useUnsavedGuard';
import {
  FAQ_ID, PARTNERS_ID, buildPages, countSlots, draftChanges, draftProblem, isDirty, isMediaSlot, matchesQuery,
  type AdminPage, type SlotDraft, type SlotPage,
} from './siteContent/model';

type KindFilter = 'all' | 'media' | 'text';

const EMPTY_SLOTS: Record<string, AdminSlot> = {};

interface CardHandlers {
  onDraft: (key: string, patch: SlotDraft) => void;
  onSave: (key: string) => void;
  onDiscard: (key: string) => void;
  onUploaded: (def: SlotDef, asset: MediaAsset) => Promise<void>;
  onReset: (def: SlotDef) => void;
}
const NO_HANDLERS: CardHandlers = {
  onDraft: () => undefined, onSave: () => undefined, onDiscard: () => undefined, onUploaded: async () => undefined, onReset: () => undefined,
};

/* ── The list of pages ── */

function PageNav({
  pages, content, selectedId, onSelect, orientation, searching,
}: {
  pages: AdminPage[];
  content: AdminSiteContent;
  selectedId: string;
  onSelect: (id: string) => void;
  orientation: 'vertical' | 'horizontal';
  searching: boolean;
}) {
  const horizontal = orientation === 'horizontal';
  return (
    <Box
      component="nav"
      aria-label="Stránky webu"
      data-nav={horizontal ? 'chips' : 'list'}
      sx={horizontal
        ? { display: 'flex', gap: 1, overflowX: 'auto', pb: 1, mx: -2, px: 2, scrollbarWidth: 'thin' }
        : { display: 'flex', flexDirection: 'column', gap: 0.25 }}
    >
      {pages.map((page) => {
        const active = !searching && page.id === selectedId;
        const counter = page.type === 'slots'
          ? (() => { const c = countSlots(page.slots, content.slots); return `${c.filled} / ${c.total}`; })()
          : String(page.type === 'partners' ? content.partners.length : content.faq.length);
        return (
          <ButtonBase
            key={page.id}
            onClick={() => onSelect(page.id)}
            aria-current={active ? 'page' : undefined}
            sx={horizontal
              ? {
                  flexShrink: 0, minHeight: 44, px: 1.75, gap: 1, borderRadius: 999, fontSize: 14, fontWeight: 600,
                  border: '1px solid', borderColor: active ? 'primary.main' : settingsLine,
                  bgcolor: active ? 'primary.main' : 'background.paper', color: active ? '#FFFFFF' : 'text.primary', ...focusRing,
                }
              : {
                  justifyContent: 'space-between', gap: 1, minHeight: 44, px: 1.5, py: 0.75, fontSize: 14.5, textAlign: 'left',
                  borderLeft: '3px solid', borderColor: active ? 'primary.main' : 'transparent', borderRadius: '0 8px 8px 0',
                  fontWeight: active ? 700 : 500, bgcolor: active ? settingsSelected : 'transparent',
                  '&:hover': { bgcolor: active ? settingsSelected : settingsHover }, ...focusRing,
                }}
          >
            <span>{page.label}</span>{' '}
            <Box component="span" sx={{ fontSize: 13, fontWeight: 600, opacity: horizontal && active ? 1 : 0.75, whiteSpace: 'nowrap' }}>{counter}</Box>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/* ── The page ── */

export default function SiteContentAdminPage() {
  const device = useDevice();
  const phone = device === 'phone';
  const queryClient = useQueryClient();
  const query = useAdminSiteContent();
  const content = query.data;

  const pages = useMemo(buildPages, []);
  const [selectedId, setSelectedId] = useState(pages[0].id);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [drafts, setDrafts] = useState<Record<string, SlotDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<ReadonlySet<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const slots = content?.slots ?? EMPTY_SLOTS;
  /* The cards are many: the list follows the box a moment later, so typing stays instant. */
  const searchText = useDeferredValue(search);
  const searching = searchText.trim() !== '';
  const selected = pages.find((page) => page.id === selectedId) ?? pages[0];

  const dirtyKeys = Object.keys(drafts).filter((key) => {
    const def = slotDef(key);
    return def !== undefined && isDirty(def, slots[key], drafts[key]);
  });
  useUnsavedGuard(dirtyKeys.length > 0);

  const setError = (key: string, message: string | undefined) =>
    setErrors((current) => {
      const next = { ...current };
      if (message === undefined) delete next[key];
      else next[key] = message;
      return next;
    });
  const clearDraft = (key: string) =>
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

  /* ── Writes ── */

  const putSlot = useSiteMutation<{ key: string; kind: SlotDef['kind']; changes: SlotUpdate }>({
    run: ({ key, changes }) => siteContentAdminApi.putSlot(key, changes),
    optimistic: (current, { key, kind, changes }) => ({
      ...current,
      slots: { ...current.slots, [key]: { ...(current.slots[key] ?? { kind }), ...changes } },
    }),
    failure: 'Uložení se nepodařilo.',
    onError: (message, { key }) => setError(key, message),
  });

  const resetSlot = useSiteMutation<string>({
    run: (key) => siteContentAdminApi.deleteSlot(key),
    optimistic: (current, key) => {
      const next = { ...current.slots };
      delete next[key];
      return { ...current, slots: next };
    },
    success: 'Vráceno výchozí',
    failure: 'Vrácení výchozího se nepodařilo.',
    onError: (message, key) => setError(key, message),
    onDone: (key) => { clearDraft(key); setError(key, undefined); },
  });

  const saveOne = async (key: string): Promise<boolean> => {
    const def = slotDef(key);
    if (def === undefined) return true;
    const changes = draftChanges(def, slots[key], drafts[key]);
    if (Object.keys(changes).length === 0) return true;
    const problem = draftProblem(def, changes);
    if (problem !== undefined) {
      setError(key, problem);
      return false;
    }
    setError(key, undefined);
    setSavingKeys((current) => new Set(current).add(key));
    try {
      await putSlot.mutateAsync({ key, kind: def.kind, changes });
      clearDraft(key);
      return true;
    } catch {
      return false; // the mutation already wrote the sentence under the card
    } finally {
      setSavingKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const saveKeys = async (keys: string[]) => {
    let saved = 0;
    for (const key of keys) {
      if (await saveOne(key)) saved += 1;
    }
    if (saved > 0) toast.success(saved === 1 ? 'Uloženo' : `Uloženo: ${saved} změn`);
  };

  const attachAsset = async (def: SlotDef, asset: MediaAsset) => {
    await siteContentAdminApi.putSlot(def.key, { assetId: asset.assetId });
    queryClient.setQueryData<AdminSiteContent>(ADMIN_SITE_CONTENT_KEY, (current) =>
      current === undefined ? current : {
        ...current,
        slots: {
          ...current.slots,
          [def.key]: {
            ...(current.slots[def.key] ?? {}),
            kind: asset.kind,
            mediaUrl: asset.url,
            ...(asset.posterUrl !== undefined ? { posterUrl: asset.posterUrl } : {}),
            ...(asset.width !== undefined ? { width: asset.width } : {}),
            ...(asset.height !== undefined ? { height: asset.height } : {}),
            assetId: asset.assetId,
            updatedAtUtc: new Date().toISOString(),
          },
        },
      });
    setError(def.key, undefined);
    toast.success('Soubor nahrán');
    void queryClient.invalidateQueries({ queryKey: ADMIN_SITE_CONTENT_KEY });
  };

  const askReset = (def: SlotDef) =>
    setConfirm(isMediaSlot(def)
      ? {
          title: 'Odstranit soubor?',
          body: `Na webu se místo „${def.label}“ znovu ukáže šedým polem s popiskem.`,
          confirmLabel: 'Ano, odstranit',
          onConfirm: () => resetSlot.mutate(def.key),
        }
      : {
          title: 'Vrátit výchozí text?',
          body: `Váš text „${def.label}“ se smaže a na webu bude znovu výchozí znění.`,
          confirmLabel: 'Ano, vrátit',
          onConfirm: () => resetSlot.mutate(def.key),
        });

  /*
   * The handlers the cards get are the same functions on every render (the cards are memoised, so
   * typing in one does not re-render fifty others); they call the latest version of the real ones.
   */
  const latest = useRef<CardHandlers>(NO_HANDLERS);
  useLayoutEffect(() => {
    latest.current = {
      onDraft: (key, patch) => {
        setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
        setError(key, undefined);
      },
      onSave: (key) => void saveKeys([key]),
      onDiscard: (key) => { clearDraft(key); setError(key, undefined); },
      onUploaded: attachAsset,
      onReset: askReset,
    };
  });
  const handlers = useMemo(() => ({
    onDraft: (key: string, patch: SlotDraft) => latest.current.onDraft(key, patch),
    onSave: (key: string) => latest.current.onSave(key),
    onDiscard: (key: string) => latest.current.onDiscard(key),
    onUploaded: (def: SlotDef, asset: MediaAsset) => latest.current.onUploaded(def, asset),
    onReset: (def: SlotDef) => latest.current.onReset(def),
  }), []);

  /* ── What to show ── */

  const card = (def: SlotDef, pageLabel?: string, publicPath?: string) => (
    <SlotCard
      key={def.key}
      def={def}
      value={slots[def.key]}
      draft={drafts[def.key]}
      error={errors[def.key]}
      saving={savingKeys.has(def.key)}
      pageLabel={pageLabel}
      publicPath={publicPath}
      onDraft={handlers.onDraft}
      onSave={handlers.onSave}
      onDiscard={handlers.onDiscard}
      onUploaded={handlers.onUploaded}
      onReset={handlers.onReset}
    />
  );

  const columns = device === 'desktop' ? 2 : 1;
  const grid = { display: 'grid', gap: 2, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, alignItems: 'start' } as const;

  const slotPages = pages.filter((page): page is SlotPage => page.type === 'slots');
  const results = searching
    ? slotPages.flatMap((page) => page.slots.filter((def) => matchesQuery(def, searchText)).map((def) => ({ def, page })))
    : [];

  const renderSlotPage = (page: SlotPage) => {
    const counter = countSlots(page.slots, slots);
    const keep = (def: SlotDef) => kindFilter === 'all' || (kindFilter === 'media') === isMediaSlot(def);
    return (
      <Stack spacing={2.5} component="section" aria-label={page.label}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between' }}>
          <Box>
            <Typography component="h2" sx={TYPE.sectionTitle}>{page.label}</Typography>
            <Typography sx={TYPE.caption}>
              Fotky a videa: {counter.mediaFilled} z {counter.mediaTotal} · Vlastní texty: {counter.textFilled} z {counter.textTotal}
            </Typography>
          </Box>
          {page.path !== undefined && (
            <Link
              href={page.path} target="_blank" rel="noopener" aria-label={`Zobrazit stránku „${page.label}“ na webu`}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minHeight: 44, fontWeight: 600 }}
            >
              Zobrazit na webu <OpenIcon sx={{ fontSize: 16 }} />
            </Link>
          )}
        </Stack>
        <FilterChips<KindFilter>
          ariaLabel="Co zobrazit"
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { key: 'all', label: 'Vše', count: counter.total },
            { key: 'media', label: 'Fotky a videa', count: counter.mediaTotal },
            { key: 'text', label: 'Texty', count: counter.textTotal },
          ]}
        />
        {page.sections.map((section) => {
          const visible = section.slots.filter(keep);
          if (visible.length === 0) return null;
          return (
            <Stack key={section.title} spacing={1.5} component="section" aria-label={section.title}>
              <Typography component="h3" sx={TYPE.label}>{section.title}</Typography>
              <Box sx={grid} data-columns={columns}>{visible.map((def) => card(def, undefined, page.path))}</Box>
            </Stack>
          );
        })}
      </Stack>
    );
  };

  const body = content === undefined ? null : searching ? (
    <Stack spacing={2} component="section" aria-label="Výsledky hledání">
      <Typography component="h2" sx={TYPE.sectionTitle}>Výsledky hledání</Typography>
      <Typography sx={TYPE.caption} role="status">
        {results.length === 0 ? `Nic neodpovídá „${searchText.trim()}“.` : `Nalezeno míst: ${results.length}`}
      </Typography>
      <Box sx={grid} data-columns={columns}>{results.map(({ def, page }) => card(def, page.label, page.path))}</Box>
    </Stack>
  ) : selected.type === 'slots' ? renderSlotPage(selected)
    : selected.id === PARTNERS_ID ? <PartnersSection partners={content.partners} onConfirm={setConfirm} />
    : selected.id === FAQ_ID ? <FaqSection items={content.faq} onConfirm={setConfirm} />
    : null;

  const nav = content === undefined ? null : (
    <PageNav
      pages={pages}
      content={content}
      selectedId={selected.id}
      searching={searching}
      onSelect={(id) => { setSearch(''); setSelectedId(id); }}
      orientation={phone ? 'horizontal' : 'vertical'}
    />
  );

  const searchField = (
    <TextField
      fullWidth
      size="small"
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder="Hledat v textech a fotkách"
      slotProps={{
        htmlInput: { 'aria-label': 'Hledat v textech a fotkách', style: { minHeight: 28 } },
        input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
      }}
      sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
    />
  );

  return (
    <SettingsScreen
      title="Média a texty"
      subtitle="Fotky, videa a texty veřejného webu. Změníte je tady, bez programátora — web si je převezme sám."
      scope="site-content"
      aside={false}
      related={false}
      actions={(
        <Button component={RouterLink} to={MEDIA_STORAGE_PATH} variant="outlined" color="inherit" startIcon={<MediaIcon />} sx={{ minHeight: 44, color: 'text.primary', borderColor: settingsLine }}>
          Úložiště médií
        </Button>
      )}
      save={{
        dirty: dirtyKeys.length > 0,
        saving: savingKeys.size > 0,
        onSave: () => void saveKeys(dirtyKeys),
        onDiscard: () => { setDrafts({}); setErrors({}); },
        saveLabel: dirtyKeys.length > 1 ? `Uložit (${dirtyKeys.length})` : 'Uložit',
      }}
      loading={content === undefined && !query.isError}
      error={query.isError ? 'Média a texty se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
    >
      {content === undefined ? null : (
        <Box data-layout={device} sx={phone ? { display: 'flex', flexDirection: 'column', gap: 2 } : { display: 'grid', gap: 3, gridTemplateColumns: '260px minmax(0, 1fr)', alignItems: 'start' }}>
          <Stack spacing={1.5} sx={phone ? undefined : { position: 'sticky', top: 16, minWidth: 0 }}>
            {searchField}
            {nav}
          </Stack>
          <Box sx={{ minWidth: 0 }}>{body}</Box>
        </Box>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </SettingsScreen>
  );
}
