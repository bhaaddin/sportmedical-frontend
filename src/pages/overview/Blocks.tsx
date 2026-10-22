/*
 * The four blocks of Přehled (R18) - presentational only; `model.ts` decides every word and number.
 *
 * Look (docs/stage4-2026-10.md): no cards, no glass, no icons. A block is a title, one thing, and white space; blocks are
 * set off from each other by one hairline. One accent (the person's picked one) marks "next" and "today"; one alert tone
 * marks a count that needs a person. One type scale: 96 (the day's number), 28 (the page title), 17 (block titles),
 * 15 (rows), 13 (meta). Details live in a pop-out (hover, focus or click), never on the screen.
 *
 * Every block has the same three states, none of them an all-clear in disguise: loading (a skeleton of the same height),
 * failed ("nepodařilo se načíst" and a retry) and ready.
 */
import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Popover, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CountUp } from '../../motion/CountUp';
import { useMotionPreference } from '../../motion/useMotionPreference';
import { accentOf, toneOf } from '../../ui/shelf/shelfStyle';
import { formatDateOnly } from '../../utils/time';
import type { AttentionBlock, AttentionRow, ClubsBlock, PersonAt, TodayBlock, WeekBlock } from './model';

const plural = (n: number, one: string, few: string, many: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/** The minimum a tap target is. */
const TARGET = 44;

const metaSx = { fontSize: 13, color: 'text.secondary', lineHeight: 1.4 } as const;

const HIDDEN = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const;

/** One block: a title row (title left, a quiet aside right), then its one thing. */
export function Block({
  kind,
  title,
  aside,
  children,
  sx,
  quiet = false,
}: {
  kind: 'block' | 'list' | 'chart';
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  sx?: object;
  /** The block's own words are its title (the day's number reads "termínů dnes"): the heading stays for screen readers only. */
  quiet?: boolean;
}) {
  const id = `ov-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <Box component="section" data-ov={kind} aria-labelledby={id} sx={{ minWidth: 0, position: 'relative', ...sx }}>
      <Box sx={quiet ? { position: 'absolute', top: 0, right: 0, zIndex: 1 } : { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 1, minHeight: 28 }}>
        <Typography id={id} component="h2" sx={quiet ? HIDDEN : { fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</Typography>
        {aside}
      </Box>
      {children}
    </Box>
  );
}

/** "Nepodařilo se načíst" with a retry: a failed source is said, never drawn as zero. */
export function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Box aria-live="polite" data-ov-state="error" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>{what} se nepodařilo načíst.</Typography>
      <Button onClick={onRetry} size="small" variant="text" sx={{ minHeight: TARGET, px: 1.5, fontWeight: 600 }}>Zkusit znovu</Button>
    </Box>
  );
}

/** A quiet "Zobrazit vše" link. */
export function ShowAll({ to, children = 'Zobrazit vše' }: { to: string; children?: ReactNode }) {
  return (
    <Button component={RouterLink} to={to} variant="text" size="small" sx={{ minHeight: TARGET, px: 1, fontWeight: 600, alignSelf: 'flex-start', ml: -1 }}>
      {children}
    </Button>
  );
}

/** A name as a small pill: a link to the card when the patient is registered, plain text otherwise. */
function Person({ person, accent = false, withTime = false }: { person: PersonAt; accent?: boolean; withTime?: boolean }) {
  const pill = (t: import('@mui/material/styles').Theme) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.75,
    maxWidth: '100%',
    minHeight: 36,
    px: 1.5,
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    color: accent ? toneOf(t, 'primary').fg : 'text.primary',
    bgcolor: accent ? toneOf(t, 'primary').bg : alpha(t.palette.text.primary, 0.07),
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  const label = withTime ? `${person.name}, ${person.time}` : person.name;
  return person.patientId !== '' ? (
    <Box component={RouterLink} to={`/patients/${encodeURIComponent(person.patientId)}`} aria-label={label} sx={(t) => ({ ...pill(t), '&:hover': { bgcolor: accent ? alpha(accentOf(t), 0.22) : alpha(t.palette.text.primary, 0.12) } })}>
      {person.name}
    </Box>
  ) : (
    <Box component="span" sx={pill}>{person.name}</Box>
  );
}

/* ───────────────────────────── 1. Dnes ───────────────────────────── */

export function TodayHero({ block, onRetry }: { block: TodayBlock; onRetry: () => void }) {
  const waiting = block.waiting;
  return (
    <Block quiet kind="block" title="Dnes" aside={block.status === 'ready' ? <ShowAll to="/dnes">Dnešní přehled</ShowAll> : undefined}>
      {block.status === 'loading' ? (
        <Box aria-busy="true">
          <Skeleton variant="text" width={120} sx={{ fontSize: 96, lineHeight: 1 }} />
          <Skeleton variant="text" width="70%" sx={{ fontSize: 20 }} />
        </Box>
      ) : block.status === 'error' ? (
        <Failed what="Dnešní termíny" onRetry={onRetry} />
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap' }}>
            <Typography component="div" data-testid="today-count" sx={{ fontSize: { xs: 64, sm: 96 }, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
              <CountUp value={block.total} />
            </Typography>
            <Typography sx={{ fontSize: 22, color: 'text.secondary' }}>
              {block.total === 0 ? 'Na dnešek nikdo objednaný' : plural(block.total, 'termín dnes', 'termíny dnes', 'termínů dnes')}
            </Typography>
          </Box>

          {block.total > 0 && (
            <Box sx={{ mt: { xs: 2, md: 3 }, display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 2.5, rowGap: 1.5, alignItems: 'center' }}>
              <Typography sx={metaSx}>Další</Typography>
              {block.next === null ? (
                <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>Dnes už nikdo další</Typography>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <Typography data-testid="next-time" sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{block.next.time}</Typography>
                  <Person person={block.next} accent />
                </Box>
              )}
              {waiting.length > 0 && (
                <>
                  <Typography sx={metaSx}>Čeká</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', minWidth: 0 }} data-testid="waiting">
                    {waiting.slice(0, 2).map((p) => <Person key={p.id} person={p} withTime />)}
                    {waiting.length > 2 && (
                      <Box component={RouterLink} to="/dnes" aria-label={`Dalších ${waiting.length - 2} čeká`} sx={{ ...metaSx, display: 'inline-flex', alignItems: 'center', minHeight: 36, textDecoration: 'none', fontWeight: 600 }}>
                        +{waiting.length - 2}
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Box>
          )}
        </>
      )}
    </Block>
  );
}

/* ───────────────────────────── 2. Vyžaduje pozornost ───────────────────────────── */

/** A row of a list block: the thing left, a figure right, 48px tall, a link. */
function ListRow({ to, state, primary, figure, figureAlert = false, pop }: { to: string; state?: Record<string, unknown>; primary: string; figure: string; figureAlert?: boolean; pop?: ReactNode }) {
  const row = (
    <Box
      component={RouterLink}
      to={to}
      state={state}
      data-row=""
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        minHeight: { xs: 44, md: 48 },
        px: 1.25,
        mx: -1.25,
        borderRadius: 1.5,
        color: 'text.primary',
        textDecoration: 'none',
        fontSize: 15,
        '&:hover, &:focus-visible': { bgcolor: alpha(t.palette.text.primary, 0.06) },
      })}
    >
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{primary}</Box>
      <Box component="span" sx={(t) => ({ flexShrink: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: figureAlert ? toneOf(t, 'red').fg : 'text.secondary' })}>{figure}</Box>
    </Box>
  );
  return pop === undefined ? row : <Tooltip title={pop} placement="left" enterDelay={200} arrow>{row}</Tooltip>;
}

const popBody = (row: AttentionRow): ReactNode => (
  <Box sx={{ maxWidth: 320 }}>
    <Box sx={{ fontSize: 13, mb: row.cases.length > 0 ? 0.75 : 0 }}>{row.summary}</Box>
    {row.cases.map((c) => <Box key={c} sx={{ fontSize: 13, fontWeight: 600, py: 0.25 }}>{c}</Box>)}
  </Box>
);

export function AttentionList({ block, onRetry }: { block: AttentionBlock; onRetry: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const partial = block.unreadable > 0 && block.rows.length > 0;
  /* Nothing to say, and the sources really answered: the block collapses to one quiet line. */
  const clear = block.status === 'ready' && block.rows.length === 0;

  if (clear) {
    return (
      <Box component="section" data-ov="list" data-ov-state="clear" aria-label="Vyžaduje pozornost" sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>Vyžaduje pozornost</Typography>
        <Typography sx={metaSx}>Vše vyřízeno</Typography>
      </Box>
    );
  }
  return (
    <Block kind="list" title="Vyžaduje pozornost" aside={block.status === 'ready' && block.total > 0 ? <Typography sx={(t) => ({ fontSize: 13, fontWeight: 700, color: toneOf(t, 'red').fg })}>{block.total}</Typography> : undefined}>
      {block.status === 'loading' ? (
        <Box aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} variant="text" sx={{ fontSize: 15, height: 44 }} />)}</Box>
      ) : block.status === 'error' ? (
        <Failed what="Co vyžaduje pozornost" onRetry={onRetry} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {block.rows.map((r) => (
            <ListRow key={r.id} to={r.to} primary={r.title} figure={String(r.count)} figureAlert pop={popBody(r)} />
          ))}
          {partial && (
            <Box sx={{ ...metaSx, mt: 1 }}>
              Část údajů se nenačetla. <Button onClick={onRetry} size="small" variant="text" sx={{ minHeight: TARGET, fontWeight: 600 }}>Zkusit znovu</Button>
            </Box>
          )}
          {block.rest.length > 0 && (
            <>
              <Button onClick={(e) => setAnchor(e.currentTarget)} variant="text" size="small" aria-haspopup="dialog" sx={{ minHeight: TARGET, px: 1, fontWeight: 600, alignSelf: 'flex-start', ml: -1 }}>
                Zobrazit vše
              </Button>
              <Popover open={anchor !== null} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
                <Box sx={{ p: 2, minWidth: 280 }}>
                  <Typography sx={{ ...metaSx, mb: 0.5 }}>Dalších {block.rest.length} {plural(block.rest.length, 'oblast', 'oblasti', 'oblastí')}</Typography>
                  {block.rest.map((r) => <ListRow key={r.id} to={r.to} primary={r.title} figure={String(r.count)} figureAlert pop={popBody(r)} />)}
                </Box>
              </Popover>
            </>
          )}
        </Box>
      )}
    </Block>
  );
}

/* ───────────────────────────── 3. Tento týden ───────────────────────────── */

export function WeekChart({ block, onRetry }: { block: WeekBlock; onRetry: () => void }) {
  const { micro } = useMotionPreference();
  const long = (iso: string): string => formatDateOnly(iso).replace(/\s+/g, ' ');
  return (
    <Block kind="chart" sx={{ display: 'flex', flexDirection: 'column', flex: { md: '1 1 0' }, minHeight: { md: 190 }, maxHeight: { md: 300 } }} title="Tento týden" aside={block.status === 'ready' ? <Typography sx={metaSx}>{block.total} {plural(block.total, 'termín', 'termíny', 'termínů')}</Typography> : undefined}>
      {block.status === 'error' ? (
        <Failed what="Vytížení týdne" onRetry={onRetry} />
      ) : (
        <Box
          role="list"
          aria-label="Termíny po dnech tohoto týdne"
          aria-busy={block.status === 'loading' ? 'true' : undefined}
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 1, md: 1.5 }, alignItems: 'end', height: { xs: 96, sm: 170, md: 'auto' }, flex: { md: '1 1 0' }, minHeight: { md: 150 } }}
        >
          {block.days.map((d) => {
            const ratio = block.status === 'ready' ? d.count / block.max : 0;
            return (
              <Tooltip key={d.date} title={`${d.label} ${long(d.date)}: ${d.count} ${plural(d.count, 'termín', 'termíny', 'termínů')}`} placement="top" arrow enterDelay={80}>
                <Box
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${d.label} ${long(d.date)}: ${block.status === 'ready' ? d.count : 'načítá se'}`}
                  aria-current={d.today ? 'date' : undefined}
                  data-day={d.date}
                  data-today={d.today ? '' : undefined}
                  sx={(t) => ({ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', height: '100%', minWidth: 0, outlineOffset: 2, borderRadius: 1, '&:focus-visible': { outline: `2px solid ${accentOf(t)}` } })}
                >
                  <Box sx={{ ...metaSx, textAlign: 'center', mb: 0.5, minHeight: 18, fontWeight: 700, color: d.today ? 'text.primary' : 'transparent', fontVariantNumeric: 'tabular-nums' }}>
                    {block.status === 'ready' && d.today ? d.count : ''}
                  </Box>
                  <Box
                    data-bar=""
                    sx={(t) => ({
                      height: `calc(${Math.max(ratio, block.status === 'ready' ? 0.03 : 0.12)} * (100% - 44px))`,
                      minHeight: 3,
                      borderRadius: '6px 6px 2px 2px',
                      bgcolor: d.today ? accentOf(t) : alpha(t.palette.text.primary, block.status === 'loading' ? 0.08 : 0.2),
                      transition: micro ? 'height 180ms ease-out' : 'none',
                    })}
                  />
                  <Box sx={{ ...metaSx, textAlign: 'center', mt: 0.75, fontWeight: d.today ? 700 : 500, color: d.today ? 'text.primary' : 'text.secondary' }}>{d.label}</Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}
    </Block>
  );
}

/* ───────────────────────────── 4. Kluby k vyřízení ───────────────────────────── */

export function ClubsList({ block, onRetry }: { block: ClubsBlock; onRetry: () => void }) {
  if (block.status === 'ready' && block.count === 0) {
    return (
      <Box component="section" data-ov="list" data-ov-state="clear" aria-label="Kluby k vyřízení" sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>Kluby k vyřízení</Typography>
        <Typography sx={metaSx}>Žádná poptávka</Typography>
      </Box>
    );
  }
  return (
    <Block kind="list" title="Kluby k vyřízení" aside={block.status === 'ready' ? <Typography sx={(t) => ({ fontSize: 13, fontWeight: 700, color: toneOf(t, 'red').fg })}>{block.count}</Typography> : undefined}>
      {block.status === 'loading' ? (
        <Box aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} variant="text" sx={{ fontSize: 15, height: 44 }} />)}</Box>
      ) : block.status === 'error' ? (
        <Failed what="Poptávky klubů" onRetry={onRetry} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {block.rows.map((r) => (
            <ListRow
              key={r.id}
              to={r.to}
              state={r.state}
              primary={r.clubName}
              figure={`${r.seats} ${plural(r.seats, 'místo', 'místa', 'míst')}`}
              pop={r.since === null ? undefined : <Box sx={{ fontSize: 13 }}>Odesláno {formatDateOnly(r.since)}</Box>}
            />
          ))}
          {block.more > 0 && <ShowAll to="/clubs/objednavky">{`Zobrazit vše (${block.count})`}</ShowAll>}
        </Box>
      )}
    </Block>
  );
}
