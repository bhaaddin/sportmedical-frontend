/* ══════════════════════════════════════════════════════════════
   "NA ČEM MĚŘÍME" - the four devices, as the pinned sequence of the home page.

   Without the scroll scene (server render, no script, 'omezené', 'vypnuto', a failed download) this is an ordinary dark
   section: a title, the four devices side by side, the measurement trace drawn complete beneath them. With the scene
   (src/motion/scenes/measure.ts) the section becomes a tall track and its content a `position: sticky` stage that
   stays on screen while the track scrolls past; the devices take the stage one at a time and the trace is drawn.
   Sticky, not a script-driven pin: the browser holds the stage (no jitter, no layout shift, no JavaScript on the
   scroll's critical path) and the scene only reads the scroll position. The layout switches on `[data-stage="pinned"]`,
   which the scene sets on the section.
   Texts are the clinic's own slots (landing.equipment.*); nothing here is typed copy.
   ══════════════════════════════════════════════════════════════ */

import { Box } from '@mui/material';
import { ShaderBackdrop } from '../../motion/ShaderBackdrop';
import { SlotText, useSlotText } from '../../site/SlotText';
import { Eyebrow, SectionTitle } from '../ui';
import { FONT_HEAD, GUTTER, MQ, SITE_MAX, W } from '../tokens';
import { SignalLine } from './Signal';

const DEVICES = [1, 2, 3, 4] as const;
/* The staged layout, switched on by the scene on the section itself, only when it really runs. */
const STAGED = '[data-stage="pinned"] &';
const STAGED_SELF = '&[data-stage="pinned"]';
/* The stage is the screen minus the sticky header (and, on a phone, the pinned booking bar: --sm-bar); the track is the
   stage plus 90 % of a screen per device. */
const STAGE_HEIGHT = 'calc(100svh - var(--sm-hh, 72px) - var(--sm-bar, 0px))';

function Tick({ n }: { n: number }) {
  const name = useSlotText(`landing.equipment.${n}.name`);
  return (
    <Box
      component="li"
      data-sm="tick"
      sx={{
        display: 'flex', alignItems: 'center', gap: '10px', color: W.white, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em',
        '&::before': { content: '""', width: 28, height: 2, bgcolor: W.orange, borderRadius: 1, flex: '0 0 auto' },
        [MQ.phoneOnly]: { fontSize: 0, gap: 0, '&::before': { width: 34, height: 3 } },
      }}
    >
      {name}
    </Box>
  );
}

export function MeasureStage() {
  return (
    <Box
      component="section"
      id="vybaveni"
      data-sm="measure"
      sx={{
        bgcolor: W.ink, color: W.white, overflow: 'clip',
        [MQ.phoneOnly]: { '--sm-bar': 'calc(62px + max(10px, env(safe-area-inset-bottom)))' },
        [STAGED_SELF]: { height: `calc(${STAGE_HEIGHT} + var(--sm-beats, 4) * 90svh)` },
      }}
    >
      <Box
        data-sm="stage"
        sx={{
          position: 'relative', px: GUTTER, pt: { xs: '56px', md: '84px' }, pb: { xs: '56px', md: '84px' },
          [STAGED]: { position: 'sticky', top: 'var(--sm-hh, 72px)', height: STAGE_HEIGHT, minHeight: 500, pb: { xs: '18px', md: '30px' }, boxSizing: 'border-box' },
        }}
      >
        <ShaderBackdrop
          kind="halftone"
          accent={W.orange}
          base={W.ink}
          opacity={0.5}
          style={{ WebkitMaskImage: 'radial-gradient(70% 80% at 85% 20%, #000 0%, transparent 70%)', maskImage: 'radial-gradient(70% 80% at 85% 20%, #000 0%, transparent 70%)' }}
        />
        <Box
          sx={{
            position: 'relative', zIndex: 1, maxWidth: SITE_MAX, mx: 'auto', display: 'flex', flexDirection: 'column', gap: { xs: '28px', md: '36px' },
            [STAGED]: { height: '100%', justifyContent: 'space-between', gap: 0 },
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px 40px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Eyebrow onInk><SlotText slotKey="landing.equipment.eyebrow" /></Eyebrow>
              <SectionTitle size="md" sx={{ color: W.white }}><SlotText slotKey="landing.equipment.title" /></SectionTitle>
            </Box>
            <Box
              component="ul"
              aria-hidden="true"
              sx={{ listStyle: 'none', m: 0, p: 0, display: 'none', gap: { xs: '8px', md: '26px' }, flexWrap: 'wrap', [STAGED]: { display: 'flex' } }}
            >
              {DEVICES.map((n) => <Tick key={n} n={n} />)}
            </Box>
          </Box>

          <Box
            component="ol"
            sx={{
              listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '28px 32px',
              [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
              [MQ.desktop]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
              [STAGED]: { gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'center', flex: '1 1 auto', minHeight: 0 },
            }}
          >
            {DEVICES.map((n) => (
              <Box
                key={n}
                component="li"
                data-sm="beat"
                sx={{
                  display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, pt: '20px', borderTop: `1px solid ${W.inkBorder}`,
                  [STAGED]: { gridArea: '1 / 1', borderTop: 0, pt: 0, gap: { xs: '14px', md: '22px' }, maxWidth: 1100 },
                }}
              >
                <SlotText
                  slotKey={`landing.equipment.${n}.name`}
                  as="span"
                  dataSm="name"
                  sx={{
                    display: 'block', m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', color: W.white, lineHeight: 1,
                    [STAGED]: { fontSize: 'clamp(46px, 10.5vw, 168px)', letterSpacing: '-0.045em', lineHeight: 0.92 },
                  }}
                />
                <SlotText
                  slotKey={`landing.equipment.${n}.text`}
                  as="p"
                  dataSm="text"
                  sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.onInk, maxWidth: '46ch', [STAGED]: { fontSize: { xs: 16, md: 20 }, lineHeight: 1.55 } }}
                />
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: { xs: '8px', md: '12px' }, [STAGED]: { mt: 0, maxHeight: { xs: '20svh', md: '27svh' }, display: 'flex', alignItems: 'flex-end' } }}>
            <SignalLine scene />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
