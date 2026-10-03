/* ══════════════════════════════════════════════════════════════
   SLEVY A CENOVÉ HLADINY  (route: /nastaveni/slevy)

   Three things the clinic decides, nothing hard-coded:

     1. Skupinové slevy podle počtu osob   tiers: from N people, X %
     2. Balíčkové slevy                    per činnost, only for package lines
     3. Ruční sleva — limit podle role     above it an invoice waits for approval

     GET/PUT /api/v1/settings/discounts      (contract C3)

   The rule in one line, said where it is edited: a team's discount and the
   discount by headcount do not add up - the higher applies.

   "Uložit" is live only on a change; clicking it with a wrong row shows what is
   wrong at that row instead of sending it. The server's own refusals land at
   the row they name. A failed load keeps the frame and offers "Zkusit znovu".
   ══════════════════════════════════════════════════════════════ */

import { useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DISCOUNT_SETTINGS_QUERY_KEY, discountSettingsApi, type DiscountSettings } from '../../api/discounts';
import { activitiesApi } from '../../api/activities';
import { useDevice } from '../../layout/useDevice';
import { SettingsAsideCard, SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import { DiscountPreview, PackageEditor, RoleLimitEditor, SectionCard, TierEditor } from './discounts/DiscountEditors';
import {
  emptyErrors, hasErrors, placeServerErrors, signature, tierRanges, toDraft, toPayload, validateDraft,
  type DiscountDraft, type DiscountErrors, type SentKeys,
} from './discounts/discountLogic';

/** The sentence of a row's own error wins over the client's: the server saw the whole picture. */
function mergeErrors(client: DiscountErrors, server: DiscountErrors | null): DiscountErrors {
  if (server === null) return client;
  const group = (a: DiscountErrors['tiers'], b: DiscountErrors['tiers']): DiscountErrors['tiers'] => {
    const out: DiscountErrors['tiers'] = { ...a };
    for (const [key, row] of Object.entries(b)) out[key] = { ...out[key], ...row };
    return out;
  };
  return {
    tiers: group(client.tiers, server.tiers),
    packages: group(client.packages, server.packages),
    roles: group(client.roles, server.roles),
    general: [...client.general, ...server.general],
  };
}

export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const device = useDevice();

  const query = useQuery({ queryKey: DISCOUNT_SETTINGS_QUERY_KEY, queryFn: discountSettingsApi.get, retry: false });
  const activitiesQuery = useQuery({
    queryKey: ['settings', 'discounts', 'activities'],
    queryFn: async () => (await activitiesApi.list()).activities,
    retry: false,
  });
  const saved: DiscountSettings | undefined = query.data;

  const base = useMemo<DiscountDraft | null>(() => (saved === undefined ? null : toDraft(saved)), [saved]);
  const [edits, setEdits] = useState<DiscountDraft | null>(null);
  const draft = edits ?? base;

  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<DiscountErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const sent = useRef<SentKeys>({ tiers: [], packages: [], roles: [] });

  const dirty = base !== null && edits !== null && signature(edits) !== signature(base);
  const clientErrors = draft === null ? emptyErrors() : validateDraft(draft);

  const save = useMutation({
    mutationFn: (settings: DiscountSettings) => discountSettingsApi.put(settings),
    onSuccess: (next) => {
      queryClient.setQueryData(DISCOUNT_SETTINGS_QUERY_KEY, next);
      setEdits(null);
      setServerErrors(null);
      setFailure(null);
      setAttempted(false);
      toast.success('Slevy uloženy');
    },
    onError: (error) => {
      setServerErrors(placeServerErrors(fieldErrorsOf(error), sent.current));
      setFailure(problemMessageOf(error, 'Slevy se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const change = (patch: Partial<DiscountDraft>) => {
    if (draft === null) return;
    setEdits({ ...draft, ...patch });
    setServerErrors(null);
    setFailure(null);
  };

  const submit = () => {
    setAttempted(true);
    if (draft === null || hasErrors(clientErrors)) return;
    const { settings, keys } = toPayload(draft);
    sent.current = keys;
    save.mutate(settings);
  };

  const discard = () => {
    setEdits(null);
    setServerErrors(null);
    setFailure(null);
    setAttempted(false);
  };

  const shown = mergeErrors(attempted ? clientErrors : emptyErrors(), serverErrors);
  const ranges = draft === null ? [] : tierRanges(draft);
  const activities = activitiesQuery.data ?? [];

  const preview = draft === null ? null : (
    <DiscountPreview ranges={ranges} activities={activities} />
  );

  return (
    <SettingsScreen
      title="Slevy a cenové hladiny"
      subtitle="Čím víc lidí přijde společně, tím víc ušetří. Hladiny, balíčky i limity ručních slev určujete tady."
      scope="discounts"
      save={{ dirty, saving: save.isPending, onSave: submit, onDiscard: discard }}
      loading={draft === null && !query.isError}
      error={query.isError ? 'Slevy se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
      aside={device === 'desktop' && preview !== null ? preview : undefined}
    >
      {draft === null ? null : (
        <Stack spacing={2.5}>
          {failure !== null && <Alert severity="error">{failure}</Alert>}
          {shown.general.length > 0 && (
            <Alert severity="error">
              {shown.general.map((message) => <Box key={message}>{message}</Box>)}
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              alignItems: 'start',
              gridTemplateColumns: device === 'tablet' ? 'minmax(0, 1.4fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
            }}
          >
            <SectionCard
              id="slevy-hladiny"
              title="Skupinové slevy podle počtu osob"
              caption="Od kolika osob se jaká sleva počítá. Hranice i procenta určujete vy."
            >
              <TierEditor rows={draft.tiers} errors={shown.tiers} onChange={(tiers) => change({ tiers })} />
            </SectionCard>
            {device !== 'desktop' && preview !== null && (
              <SettingsAsideCard title="Náhled">{preview}</SettingsAsideCard>
            )}
          </Box>

          <SectionCard
            id="slevy-baliceky"
            title="Balíčkové slevy"
            caption="Sleva podle činnosti. Platí jen pro řádky balíčku, ne pro samostatně objednanou činnost."
          >
            {activitiesQuery.isError && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                action={<Button color="inherit" size="small" sx={{ minHeight: 44 }} onClick={() => void activitiesQuery.refetch()}>Zkusit znovu</Button>}
              >
                Činnosti se nepodařilo načíst, nelze z nich vybírat.
              </Alert>
            )}
            <PackageEditor
              rows={draft.packages}
              errors={shown.packages}
              activities={activities.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive }))}
              onChange={(packages) => change({ packages })}
            />
          </SectionCard>

          <SectionCard
            id="slevy-role"
            title="Ruční sleva — limit podle role"
            caption="Kolik procent smí která role přidat ručně při vystavení faktury."
          >
            <RoleLimitEditor rows={draft.roles} errors={shown.roles} onChange={(roles) => change({ roles })} />
          </SectionCard>
        </Stack>
      )}
    </SettingsScreen>
  );
}
