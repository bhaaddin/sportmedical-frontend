/*
 * Nastavení > Kluby > "Jedna objednávka na klub": the clubs whose new days all join their ONE open order.
 * A switch per club; every switch saves at once (the list is the whole setting). The board does not exist for a server
 * without the route (404) - nothing is drawn then - and a failed load or save says so and can be retried.
 */
import { Alert, Box, Button, FormControlLabel, Skeleton, Stack, Switch, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clubsApi } from '../../api/clubs';
import { getOneOrderSettings, putOneOrderSettings } from '../../api/clubOneOrder';
import { SettingsBoard } from './SettingsBoard';

const KEY = ['club-one-order-settings'] as const;

/** The list after one switch; ids stay in the order they were saved, a new one goes last. */
export const toggled = (ids: readonly string[], clubId: string, on: boolean): string[] =>
  on ? (ids.includes(clubId) ? [...ids] : [...ids, clubId]) : ids.filter((id) => id !== clubId);

export function OneOrderSettingsBoard() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: KEY, queryFn: getOneOrderSettings, retry: false, staleTime: 60_000 });
  const clubs = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => { const l = await clubsApi.getAll(false); return Array.isArray(l) ? l : []; },
    enabled: settings.data != null,
  });

  const save = useMutation({
    mutationFn: (ids: string[]) => putOneOrderSettings(ids),
    onSuccess: (next) => {
      queryClient.setQueryData(KEY, next);
      toast.success('Nastavení uloženo');
    },
    onError: () => toast.error('Nastavení se nepodařilo uložit.'),
  });

  /* 404 -> data is null: the server cannot do it yet, so the section is not shown at all. */
  if (settings.isPending || settings.data === null) return null;

  const body = () => {
    if (settings.isError) {
      return (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void settings.refetch()}>Zkusit znovu</Button>}>
          Nastavení se nepodařilo načíst.
        </Alert>
      );
    }
    if (clubs.isPending) return <Skeleton variant="rounded" height={44} />;
    if (clubs.isError) {
      return (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void clubs.refetch()}>Zkusit znovu</Button>}>
          Kluby se nepodařilo načíst.
        </Alert>
      );
    }
    const ids = settings.data?.clubIds ?? [];
    return (
      <Stack spacing={1.5}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Vše nové pro vybrané kluby se přidává do jejich otevřené objednávky.
        </Typography>
        {clubs.data.length === 0 ? <Typography variant="body2">Zatím tu není žádný klub.</Typography> : (
          <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="one-order-clubs">
            {clubs.data.map((c) => (
              <Box component="li" key={c.id} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
                <FormControlLabel
                  sx={{ minHeight: 44, m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                  label={c.name}
                  control={(
                    <Switch
                      checked={ids.includes(c.id)}
                      disabled={save.isPending}
                      onChange={(e) => save.mutate(toggled(ids, c.id, e.target.checked))}
                      slotProps={{ input: { 'data-testid': `one-order-club-${c.id}` } as object }}
                    />
                  )}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <SettingsBoard id="club-one-order" title="Jedna objednávka na klub">
      {body()}
    </SettingsBoard>
  );
}

export default OneOrderSettingsBoard;
