/* ══════════════════════════════════════════════════════════════
   /motion-lab - every primitive of the motion kit, with the three settings one click apart.

   Dev server and `vite preview` only (labHost.ts), not linked, not prerendered. The switch at the top is the REAL
   setting (the same localStorage key Nastavení uses), so what is judged here is what a visitor would get. Each block
   has a "Přehrát znovu" that remounts it, because most of the kit plays once.
   ══════════════════════════════════════════════════════════════ */

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useThemePrefs } from '../../themePrefs';
import { CountUp } from '../CountUp';
import { KineticLines } from '../KineticText';
import { LenisProvider } from '../LenisProvider';
import { Magnetic, Tilt } from '../Magnetic';
import { Parallax } from '../Parallax';
import { PageTransition } from '../PageTransition';
import { PopIn, PresenceList, originOf } from '../Presence';
import type { PopOrigin } from '../Presence';
import { PressScale } from '../PressScale';
import { MOTION_LABELS, MOTION_MODES, osPrefersReducedMotion } from '../preference';
import { Reveal, Stagger } from '../Reveal';
import type { RevealVariant } from '../Reveal';
import { useScrollScene } from '../ScrollScene';
import { ShaderBackdrop } from '../ShaderBackdrop';
import type { ShaderKind } from '../ShaderBackdrop';
import { DIST, DUR, EASE, SPRING, STAGGER, cssEase } from '../tokens';
import { useMotionPreference } from '../useMotionPreference';
import { useRowStagger } from '../useRowStagger';

const PAGE_BG = '#0E1013';
const CARD = '#16191E';
const LINE = '#2A2F37';
const INK = '#E8EAED';
const MUTED = '#9AA1AA';
const ORANGE = '#F0912E';

function Section({ title, note, children, replay }: { title: string; note: string; children: ReactNode; replay?: () => void }) {
  return (
    <Box component="section" sx={{ py: { xs: 5, md: 7 }, borderTop: `1px solid ${LINE}` }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ maxWidth: 680 }}>
          <Typography component="h2" sx={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: INK }}>{title}</Typography>
          <Typography sx={{ color: MUTED, mt: 0.75, lineHeight: 1.55 }}>{note}</Typography>
        </Box>
        {replay && (
          <Button variant="outlined" onClick={replay} sx={{ minHeight: 44, color: INK, borderColor: LINE }}>
            Přehrát znovu
          </Button>
        )}
      </Stack>
      {children}
    </Box>
  );
}

function Tile({ children, label, sx }: { children: ReactNode; label: string; sx?: object }) {
  return (
    <Box sx={{ bgcolor: CARD, border: `1px solid ${LINE}`, borderRadius: '14px', p: 2.5, minHeight: 140, display: 'flex', flexDirection: 'column', gap: 1.5, ...sx }}>
      <Typography sx={{ color: MUTED, fontSize: 12, letterSpacing: '0.04em' }}>{label}</Typography>
      {children}
    </Box>
  );
}

const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 } as const;

/* ── 1. tokens ── */
function Curve({ name }: { name: keyof typeof EASE }) {
  const [x1, y1, x2, y2] = EASE[name];
  const d = `M0 100 C${x1 * 100} ${100 - y1 * 100} ${x2 * 100} ${100 - y2 * 100} 100 0`;
  return (
    <svg viewBox="-6 -20 112 140" width="100%" height={86} aria-label={`křivka ${name}`}>
      <rect x="0" y="0" width="100" height="100" fill="none" stroke={LINE} />
      <path d={d} fill="none" stroke={ORANGE} strokeWidth="3" />
    </svg>
  );
}

function Tokens() {
  return (
    <Box sx={grid}>
      <Tile label="Délky (s)">
        {Object.entries(DUR).map(([name, value]) => (
          <Stack key={name} direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ width: 84, color: INK, fontSize: 13 }}>{name}</Typography>
            <Box sx={{ height: 8, borderRadius: 4, bgcolor: ORANGE, width: `${Math.max(4, value * 80)}%` }} />
            <Typography sx={{ color: MUTED, fontSize: 12 }}>{value}</Typography>
          </Stack>
        ))}
      </Tile>
      <Tile label="Křivky">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {(Object.keys(EASE) as (keyof typeof EASE)[]).map((name) => (
            <Box key={name}>
              <Curve name={name} />
              <Typography sx={{ color: INK, fontSize: 12, textAlign: 'center' }}>{name}</Typography>
              <Typography sx={{ color: MUTED, fontSize: 10, textAlign: 'center' }}>{cssEase(name).slice(13, -1)}</Typography>
            </Box>
          ))}
        </Box>
      </Tile>
      <Tile label="Pružiny a vzdálenosti">
        {Object.entries(SPRING).map(([name, spring]) => (
          <Typography key={name} sx={{ color: INK, fontSize: 13 }}>
            {name} <Box component="span" sx={{ color: MUTED }}>tuhost {spring.stiffness} · tlumení {spring.damping}</Box>
          </Typography>
        ))}
        <Typography sx={{ color: MUTED, fontSize: 12 }}>
          nudge {DIST.nudge} px · rise {DIST.rise} px · slide {DIST.slide} px · stisk {DIST.press} · rozestup řádků {STAGGER.rows * 1000} ms
        </Typography>
      </Tile>
    </Box>
  );
}

/* ── 2. reveal ── */
const VARIANTS: RevealVariant[] = ['fade', 'rise', 'scale', 'wipe', 'left', 'right'];

function RevealDemo() {
  return (
    <Box>
      <Box sx={{ height: { xs: '55vh', md: '70vh' }, display: 'grid', placeItems: 'center', color: MUTED, border: `1px dashed ${LINE}`, borderRadius: '14px', mb: 2 }}>
        Rolujte dolů – karty se objeví, až přijdou do obrazu
      </Box>
      <Box sx={grid}>
        {VARIANTS.map((variant) => (
          <Reveal key={variant} variant={variant}>
            <Tile label={`Reveal · ${variant}`}>
              <Typography sx={{ color: INK, fontSize: 20, fontWeight: 700 }}>Sportovní diagnostika</Typography>
              <Typography sx={{ color: MUTED, fontSize: 14 }}>Prvek, který se při rolování objeví jednou.</Typography>
            </Tile>
          </Reveal>
        ))}
      </Box>
      <Stagger variant="rise" step={STAGGER.items} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 16 }}>
        {[1, 2, 3].map((n) => (
          <Tile key={n} label={`Stagger · ${n}`}>
            <Typography sx={{ color: INK }}>Děti vstupují jedno po druhém</Typography>
          </Tile>
        ))}
      </Stagger>
    </Box>
  );
}

/* ── 3. answers to actions ── */
function Answers() {
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState<{ open: boolean; origin: PopOrigin | null }>({ open: false, origin: null });
  const [items, setItems] = useState(['Prohlídka', 'Diagnostika', 'InBody']);
  const [tab, setTab] = useState('a');
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState(0);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [rowsReady, setRowsReady] = useState(true);
  useRowStagger(rowsRef, rowsReady);

  return (
    <Box sx={grid}>
      <Tile label="PressScale a tlačítka motivu (stisk)">
        <PressScale as="button" type="button" className="x" style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${LINE}`, background: ORANGE, color: '#1A1206', fontWeight: 700, padding: '0 20px', cursor: 'pointer' }}>
          Držte stisknuto
        </PressScale>
        <Button variant="contained" sx={{ alignSelf: 'flex-start' }}>MUI tlačítko</Button>
      </Tile>

      <Tile label="Dialog roste z tlačítka (pružina)">
        <Button variant="outlined" onClick={() => setOpen(true)} sx={{ alignSelf: 'flex-start', color: INK }}>Otevřít dialog</Button>
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>Potvrdit přesun</DialogTitle>
          <DialogContent><Typography>Dialog vyroste z místa, kam jste klikli.</Typography></DialogContent>
          <DialogActions><Button onClick={() => setOpen(false)}>Zavřít</Button></DialogActions>
        </Dialog>
        <Button
          variant="outlined"
          onClick={(event) => setPop({ open: !pop.open, origin: originOf(event.nativeEvent) })}
          sx={{ alignSelf: 'flex-start', color: INK }}
        >
          PopIn panel
        </Button>
        <PopIn open={pop.open} origin={pop.origin} style={{ background: CARD, border: `1px solid ${ORANGE}`, borderRadius: 12, padding: 14, color: INK }}>
          Vyskočí z místa kliknutí a odejde rychle.
        </PopIn>
      </Tile>

      <Tile label="Seznam: přidání a odebrání">
        <Stack direction="row" sx={{ gap: 1 }}>
          <Button size="small" variant="outlined" onClick={() => setItems((list) => [...list, `Položka ${list.length + 1}`])} sx={{ color: INK }}>Přidat</Button>
          <Button size="small" variant="outlined" onClick={() => setItems((list) => list.slice(0, -1))} sx={{ color: INK }}>Odebrat</Button>
        </Stack>
        <PresenceList items={items} getKey={(x) => x} render={(x) => <Box sx={{ py: 1, color: INK, borderBottom: `1px solid ${LINE}` }}>{x}</Box>} as="ul" itemAs="li" className="lab-list" />
      </Tile>

      <Tile label="CountUp (jednou, při prvním zobrazení)">
        <Box key={count} sx={{ display: 'flex', gap: 3 }}>
          <Typography sx={{ fontSize: 34, fontWeight: 800, color: ORANGE }}><CountUp value={1248} /></Typography>
          <Typography sx={{ fontSize: 34, fontWeight: 800, color: INK }}><CountUp value={86} format={(n) => `${Math.round(n)} %`} /></Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={() => setCount((c) => c + 1)} sx={{ alignSelf: 'flex-start', color: INK }}>Znovu spočítat</Button>
      </Tile>

      <Tile label="Přechod stránky (<= 180 ms) při změně záložky">
        <Stack direction="row" sx={{ gap: 1 }}>
          {['a', 'b', 'c'].map((key) => (
            <Button key={key} size="small" variant={tab === key ? 'contained' : 'outlined'} onClick={() => setTab(key)} sx={{ color: tab === key ? undefined : INK }}>
              Záložka {key.toUpperCase()}
            </Button>
          ))}
        </Stack>
        <PageTransition routeKey={tab}>
          <Typography sx={{ color: INK }}>Obsah záložky {tab.toUpperCase()} je už hotový, jen se krátce přisune.</Typography>
        </PageTransition>
      </Tile>

      <Tile label="Řádky tabulky: kaskáda jen při prvním načtení">
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setRowsReady(false);
            setRows((r) => r + 1);
            window.setTimeout(() => setRowsReady(true), 30);
          }}
          sx={{ alignSelf: 'flex-start', color: INK }}
        >
          Načíst znovu
        </Button>
        <Box key={rows} ref={rowsRef}>
          {['Novák', 'Svobodová', 'Dvořák', 'Černá', 'Procházka', 'Kučera'].map((name) => (
            <Box key={name} sx={{ py: 0.9, color: INK, borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>{name}</Box>
          ))}
        </Box>
      </Tile>
    </Box>
  );
}

/* ── 4. physics ── */
function Physics() {
  return (
    <Box sx={grid}>
      <Tile label="Tilt (najeďte myší)">
        <Tilt style={{ background: '#1C2026', border: `1px solid ${LINE}`, borderRadius: 14, padding: 22, color: INK, transformStyle: 'preserve-3d' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 20 }}>Karta se naklání</Typography>
          <Typography sx={{ color: MUTED, fontSize: 14 }}>a zvedne se za ukazatelem.</Typography>
        </Tilt>
      </Tile>
      <Tile label="Magnetic (přibližte kurzor)">
        <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}>
          <Magnetic>
            <Button variant="contained" sx={{ borderRadius: 999, minHeight: 52, px: 4 }}>Objednat termín</Button>
          </Magnetic>
        </Box>
      </Tile>
      <Tile label="Parallax (rolujte)" sx={{ p: 0, overflow: 'hidden' }}>
        <Parallax style={{ height: 190, borderRadius: 14 }}>
          <Box sx={{ height: '100%', background: `linear-gradient(135deg, #1C2026, ${ORANGE}55)`, display: 'grid', placeItems: 'center', color: INK, fontWeight: 800 }}>Hloubka</Box>
        </Parallax>
      </Tile>
    </Box>
  );
}

/* ── 5. kinetic type ── */
function Kinetic() {
  return (
    <Tile label="KineticLines - slova vystupují z masky (CSS, hraje při načtení)">
      <Box component="h3" sx={{ m: 0, fontWeight: 800, fontSize: 'clamp(40px, 7vw, 92px)', lineHeight: 0.94, letterSpacing: '-0.045em', color: INK }}>
        <KineticLines text={'Sportovní lékařské\nprohlídky\na diagnostika'} accentLast accent={ORANGE} delay={0.1} />
      </Box>
    </Tile>
  );
}

/* ── 6. scroll scene ── */
const FX: [string, string][] = [
  ['wipe', 'Titulek odkryje klip zleva'],
  ['curtain', 'Fotka se odhrne shora dolů'],
  ['scale', 'Fotka vyroste z menšího rámu'],
  ['pan', 'Blok doputuje zprava při rolování'],
  ['ticker', 'Řádky vjíždějí jeden po druhém'],
  ['fan', 'Karty se rozdají z různých úhlů'],
  ['draw', 'Čáry se nakreslí a čísla je následují'],
  ['iris', 'Tmavý pás se otevře jako clona'],
  ['light', 'Slova citátu se rozsvěcují při čtení'],
];

function FxDemo({ name, label }: { name: string; label: string }) {
  const content = {
    wipe: <Typography component="h3" data-fx="wipe" sx={{ fontSize: 44, fontWeight: 800, color: INK, letterSpacing: '-0.03em' }}>Tři okruhy, jedna klinika</Typography>,
    curtain: (
      <Box data-fx="curtain" sx={{ height: 200, borderRadius: '14px', overflow: 'hidden' }}>
        <Box data-fx-inner="" sx={{ height: '100%', background: `linear-gradient(135deg, #20242A, ${ORANGE})`, display: 'grid', placeItems: 'center', color: '#1A1206', fontWeight: 800 }}>[FOTO]</Box>
      </Box>
    ),
    scale: <Box data-fx="scale" sx={{ height: 200, borderRadius: '14px', background: `linear-gradient(135deg, #20242A, ${ORANGE}88)` }} />,
    pan: <Box data-fx="pan" sx={{ p: 3, borderRadius: '14px', bgcolor: CARD, border: `1px solid ${LINE}`, color: INK }}>InBody 770 – celý blok se přisune</Box>,
    ticker: (
      <Box data-fx="ticker">
        {['Základní diagnostika', 'Komplexní diagnostika', 'VO2max analýza'].map((row) => (
          <Box key={row} data-fx-item="" sx={{ py: 1.4, color: INK, borderBottom: `1px solid ${LINE}` }}>{row}</Box>
        ))}
      </Box>
    ),
    fan: (
      <Box data-fx="fan" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {[1, 2, 3].map((n) => (
          <Box key={n} data-fx-item="" sx={{ p: 2.5, borderRadius: '14px', bgcolor: CARD, border: `1px solid ${LINE}`, color: INK }}>Karta {n}</Box>
        ))}
      </Box>
    ),
    draw: (
      <Box data-fx="draw" sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        {[1, 2].map((n) => (
          <Box key={n} sx={{ position: 'relative', pt: 2 }}>
            <Box data-fx-line="" sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: ORANGE }} />
            <Box data-fx-item="" sx={{ color: INK }}>Krok {n}</Box>
          </Box>
        ))}
      </Box>
    ),
    iris: <Box data-fx="iris" sx={{ height: 220, borderRadius: '14px', background: `radial-gradient(circle at 70% 30%, ${ORANGE}66, #0E1013 70%)`, border: `1px solid ${LINE}` }} />,
    light: (
      <Typography data-fx="light" sx={{ fontSize: 26, fontWeight: 600, color: INK, lineHeight: 1.4 }}>
        {'Naším cílem je poskytovat služby na nejvyšší možné úrovni odborně individuálně a s maximální precizností'.split(' ').map((word, index) => (
          <span key={index} className="sm-lw">{index > 0 ? ' ' : ''}{word}</span>
        ))}
      </Typography>
    ),
  }[name];
  return (
    <Box sx={{ minHeight: '46vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1.5 }}>
      <Typography sx={{ color: MUTED, fontSize: 12 }}>{`data-fx="${name}" · ${label}`}</Typography>
      {content}
    </Box>
  );
}

function ScrollDemo() {
  return (
    <Box>
      <Box data-lab="track" sx={{ py: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', color: MUTED, fontSize: 13, mb: 1 }}>
          <span>Průběh rolování (scrub)</span>
          <span data-lab="readout">0 %</span>
        </Stack>
        <Box sx={{ height: 6, borderRadius: 3, bgcolor: LINE }}>
          <Box data-lab="bar" sx={{ height: '100%', bgcolor: ORANGE, borderRadius: 3 }} />
        </Box>
      </Box>
      {FX.map(([name, label]) => (
        <FxDemo key={name} name={name} label={label} />
      ))}
    </Box>
  );
}

/* ── 7. shaders ── */
function Shaders() {
  const { accent } = useThemePrefs();
  const kinds: ShaderKind[] = ['mesh', 'swirl', 'halftone'];
  return (
    <Box sx={grid}>
      {kinds.map((kind) => (
        <Box key={kind} sx={{ position: 'relative', height: 220, borderRadius: '14px', overflow: 'hidden', border: `1px solid ${LINE}` }}>
          <ShaderBackdrop kind={kind} accent={accent} base="#0E1013" />
          <Typography sx={{ position: 'relative', p: 2, color: INK, fontWeight: 700 }}>{kind} · barva z Nastavení</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function MotionLabPage() {
  const { mode, setMode, followsSystem } = useMotionPreference();
  const rootRef = useRef<HTMLDivElement>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [kineticKey, setKineticKey] = useState(0);
  const [sceneKey, setSceneKey] = useState('lab');
  useScrollScene(rootRef, () => import('../scenes/lab'), sceneKey);

  return (
    <Box ref={rootRef} sx={{ bgcolor: PAGE_BG, color: INK, minHeight: '100vh', px: { xs: '16px', md: '40px' }, pb: 12 }}>
      <LenisProvider />
      <Box sx={{ position: 'sticky', top: 0, zIndex: 20, bgcolor: `${PAGE_BG}EE`, backdropFilter: 'blur(8px)', py: 1.5, borderBottom: `1px solid ${LINE}`, mx: { xs: '-16px', md: '-40px' }, px: { xs: '16px', md: '40px' } }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography component="h1" sx={{ fontSize: 18, fontWeight: 800, mr: 1 }}>Laboratoř pohybu</Typography>
          {MOTION_MODES.map((option) => (
            <Button
              key={option}
              variant={mode === option ? 'contained' : 'outlined'}
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              sx={{ minHeight: 44, color: mode === option ? undefined : INK, borderColor: LINE }}
            >
              {MOTION_LABELS[option].label}
            </Button>
          ))}
          <Typography sx={{ color: MUTED, fontSize: 12 }} data-testid="lab-status">
            {`stav: ${mode}${followsSystem ? ' (podle zařízení)' : ''} · zařízení omezuje pohyb: ${osPrefersReducedMotion() ? 'ano' : 'ne'} · <html data-motion="${document.documentElement.getAttribute('data-motion') ?? ''}">`}
          </Typography>
          <Button size="small" onClick={() => { setMode(null); setSceneKey((k) => `${k}x`); }} sx={{ color: MUTED }}>Podle zařízení</Button>
        </Stack>
      </Box>

      <Section title="Tokeny" note="Délky, křivky, pružiny a vzdálenosti jsou na jednom místě (src/motion/tokens.ts). Nikde jinde v aplikaci není vlastní milisekunda.">
        <Tokens />
      </Section>
      <Section title="Odhalení" note="Reveal a Stagger: prvek pod okrajem obrazovky se při rolování objeví. Pod ‚Omezené‘ jen prolnutí, pod ‚Vypnuto‘ nic." replay={() => setRevealKey((k) => k + 1)}>
        <RevealDemo key={revealKey} />
      </Section>
      <Section title="Odezva na akci" note="Co aplikace dělá, když na něco kliknete: stisk, dialog z tlačítka, panel, seznam, číslo, záložka, řádky tabulky.">
        <Answers />
      </Section>
      <Section title="Fyzika" note="Naklonění karty, magnetické tlačítko a hloubka obrázku. Jen myš a jen ‚Plné‘.">
        <Physics />
      </Section>
      <Section title="Kinetický nadpis" note="Slova vystupují z masky jedno za druhým. Je to CSS, takže hraje dřív než se načte skript." replay={() => setKineticKey((k) => k + 1)}>
        <Kinetic key={kineticKey} />
      </Section>
      <Section title="Scroll scény" note="GSAP ScrollTrigger: každý přechod veřejného webu na vlastním vzorku. Scéna se při přepnutí nastavení znovu sestaví." replay={() => setSceneKey((k) => `${k}r`)}>
        <ScrollDemo />
      </Section>
      <Section title="Hladké rolování" note="Lenis běží jen s myší a ‚Plné‘. Na dotykovém zařízení zůstává nativní rolování.">
        <Typography sx={{ color: INK }} data-testid="lab-lenis">{document.documentElement.classList.contains('lenis') ? 'Lenis běží.' : 'Lenis neběží (dotyk, omezený pohyb nebo ještě nenačten).'}</Typography>
      </Section>
      <Section title="Shader pozadí" note="Mesh, swirl a halftone v barvě aplikace (Nastavení → Osobní → Vzhled). Mimo obraz se zastaví, bez ‚Plné‘ je to klidný snímek, bez WebGL statický přechod.">
        <Shaders />
      </Section>
    </Box>
  );
}
