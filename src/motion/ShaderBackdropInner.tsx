/* The part of ShaderBackdrop that imports @paper-design/shaders-react. Its own file so the library is a lazy chunk
   ('shaders', vite.config.ts): ShaderBackdrop.tsx loads this with import() after the first paint. */
import { HalftoneDots, MeshGradient, Swirl } from '@paper-design/shaders-react';

export type ShaderKind = 'mesh' | 'swirl' | 'halftone';

export interface ShaderBackdropInnerProps {
  kind: ShaderKind;
  palette: { base: string; deep: string; mid: string; accent: string; glint: string };
  accent: string;
  /** False: draw one still frame (speed 0). */
  moving: boolean;
}

/** A soft radial light, as the picture the halftone turns into dots. */
const HALFTONE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><radialGradient id="g" cx="72%" cy="28%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#555"/><stop offset="1" stop-color="#000"/></radialGradient></defs><rect width="640" height="640" fill="url(#g)"/></svg>',
  );

const COMMON = { minPixelRatio: 1, maxPixelCount: 1_100_000, style: { width: '100%', height: '100%' } } as const;

export default function ShaderBackdropInner({ kind, palette, moving }: ShaderBackdropInnerProps) {
  const speed = moving ? 1 : 0;
  if (kind === 'swirl') {
    return (
      <Swirl
        {...COMMON}
        colorBack={palette.base}
        colors={[palette.deep, palette.mid, palette.accent, palette.glint]}
        bandCount={4}
        twist={0.35}
        center={0.2}
        proportion={0.5}
        softness={0.9}
        noise={0.12}
        speed={0.22 * speed}
        frame={moving ? undefined : 4200}
      />
    );
  }
  if (kind === 'halftone') {
    return (
      <HalftoneDots
        {...COMMON}
        image={HALFTONE_IMAGE}
        colorBack={palette.base}
        colorFront={palette.accent}
        size={0.5}
        radius={1.1}
        contrast={0.9}
        grid="hex"
        type="gooey"
      />
    );
  }
  return (
    <MeshGradient
      {...COMMON}
      colors={[palette.base, palette.deep, palette.mid, palette.accent]}
      distortion={0.85}
      swirl={0.55}
      grainMixer={0.1}
      grainOverlay={0.06}
      speed={0.16 * speed}
      frame={moving ? undefined : 3300}
    />
  );
}
