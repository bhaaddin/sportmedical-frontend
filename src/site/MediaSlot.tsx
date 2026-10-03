/* ══════════════════════════════════════════════════════════════
   MEDIA SLOT — a photo or a video the admin can swap without a release

   Three states, one box that always holds its space (nothing jumps when a file
   arrives):
     · nothing uploaded → a grey placeholder with the registry's caption
       ("[FOTO: spiroergometrie na ergometru]") and the recommended size;
     · an image → <img> with srcset (Cloudinary widths, see cloudinary.ts),
       lazy unless `eager`, width/height from the slot when it has them;
     · a video → its poster and a play button; the file loads on click (so a
       phone on mobile data is not made to download it) and then plays with
       controls and sound. Only a slot the admin marked `autoplay` is muted,
       looped, inline and started by itself — and never for a visitor who asked
       for reduced motion.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useSlot } from '../api/siteContent';
import type { ResolvedSlot } from '../api/siteContent';
import { cloudinaryWidth, imageSrcSet } from './cloudinary';

export interface MediaSlotProps {
  slotKey: string;
  /** Placeholder text when the registry has no caption for this key. */
  fallbackLabel?: string;
  /** Overrides the registry's aspect ratio ("4 / 3"). */
  aspect?: string;
  /** `light` = beige dashed box (on white), `dark` = dark box (on the ink bands). */
  tone?: 'light' | 'dark';
  /** Small label above the caption in the placeholder ("01 / 03"). */
  badge?: string;
  /** `sizes` of the <img>; default: full width on a phone, half on larger screens. */
  sizes?: string;
  /** The first photo of a page: loaded at once, not lazily. */
  eager?: boolean;
  /** Background of the placeholder, when a page wants a particular shade. */
  placeholderBackground?: string;
  sx?: SxProps<Theme>;
}

const PLACEHOLDER = {
  light: { bg: '#EFEAE2', border: '1px dashed #D3CBBE', color: '#8A8176', small: '#A49B8F', badge: '#A8560D' },
  dark: { bg: '#16191E', border: '1px dashed #3A4049', color: '#9AA1AA', small: '#6F7680', badge: '#F0912E' },
} as const;

function placeholderLabel(slot: ResolvedSlot, fallbackLabel: string | undefined): string {
  const text = slot.caption !== '' ? slot.caption : fallbackLabel ?? slot.key;
  return `[${slot.kind === 'video' ? 'VIDEO' : 'FOTO'}: ${text}]`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  return reduced;
}

function Placeholder({
  slot, fallbackLabel, tone, badge, background,
}: { slot: ResolvedSlot; fallbackLabel?: string; tone: 'light' | 'dark'; badge?: string; background?: string }) {
  const palette = PLACEHOLDER[tone];
  return (
    <Box
      aria-hidden="true"
      data-slot-state="placeholder"
      sx={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '8px', p: '20px', textAlign: 'center',
        bgcolor: background ?? palette.bg, border: tone === 'light' || background === undefined ? palette.border : 'none',
      }}
    >
      {badge !== undefined && (
        <Box component="span" sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: palette.badge }}>
          {badge}
        </Box>
      )}
      <Box component="span" sx={{ fontSize: { xs: 14, md: 15 }, color: palette.color }}>
        {placeholderLabel(slot, fallbackLabel)}
      </Box>
      {slot.recommended !== undefined && (
        <Box component="span" sx={{ fontSize: 12, color: palette.small }}>
          Doporučeno {slot.recommended}
        </Box>
      )}
    </Box>
  );
}

const fillImage = { display: 'block', width: '100%', height: '100%', objectFit: 'cover' } as const;

function Poster({ slot, eager, sizes }: { slot: ResolvedSlot; eager: boolean; sizes: string }) {
  if (slot.posterUrl === undefined) return <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#16191E' }} />;
  return (
    <Box
      component="img"
      src={cloudinaryWidth(slot.posterUrl, 1200)}
      srcSet={imageSrcSet(slot.posterUrl)}
      sizes={sizes}
      alt={slot.alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      sx={{ ...fillImage, position: 'absolute', inset: 0 }}
    />
  );
}

function VideoPlayer({ slot, eager, sizes }: { slot: ResolvedSlot; eager: boolean; sizes: string }) {
  const reduced = usePrefersReducedMotion();
  const [started, setStarted] = useState(false);
  const url = slot.mediaUrl as string;
  const autoplays = slot.autoplay && !reduced;

  if (autoplays) {
    return (
      <Box
        component="video"
        src={url}
        poster={slot.posterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={slot.alt !== '' ? slot.alt : undefined}
        data-slot-state="video"
        sx={{ ...fillImage, position: 'absolute', inset: 0 }}
      />
    );
  }

  if (started) {
    return (
      <Box
        component="video"
        src={url}
        poster={slot.posterUrl}
        controls
        autoPlay
        playsInline
        preload="auto"
        aria-label={slot.alt !== '' ? slot.alt : undefined}
        data-slot-state="video"
        sx={{ ...fillImage, position: 'absolute', inset: 0, bgcolor: '#000' }}
      />
    );
  }

  return (
    <Box data-slot-state="video-poster" sx={{ position: 'absolute', inset: 0 }}>
      <Poster slot={slot} eager={eager} sizes={sizes} />
      <Box
        component="button"
        type="button"
        onClick={() => setStarted(true)}
        aria-label={slot.alt !== '' ? `Přehrát video: ${slot.alt}` : 'Přehrát video'}
        sx={{
          position: 'absolute', inset: 0, width: '100%', border: 0, cursor: 'pointer', bgcolor: 'rgba(14,16,19,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color .15s ease',
          '&:hover': { bgcolor: 'rgba(14,16,19,0.36)' },
        }}
      >
        <Box
          component="span"
          sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#F0912E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#1A1206" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        </Box>
      </Box>
    </Box>
  );
}

export function MediaSlot({
  slotKey, fallbackLabel, aspect, tone = 'light', badge, sizes = '(max-width: 767px) 100vw, 50vw',
  eager = false, placeholderBackground, sx,
}: MediaSlotProps) {
  const slot = useSlot(slotKey);
  const ratio = aspect ?? slot.aspect;
  const hasFile = slot.mediaUrl !== undefined && (slot.kind === 'image' || slot.kind === 'video');

  return (
    <Box
      data-slot={slotKey}
      sx={[
        {
          position: 'relative', overflow: 'hidden', borderRadius: '16px', width: '100%', minHeight: 220,
          ...(ratio !== undefined ? { aspectRatio: ratio } : {}),
          bgcolor: tone === 'dark' ? '#16191E' : '#EFEAE2',
        },
        ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : []),
      ]}
    >
      {!hasFile && (
        <Placeholder slot={slot} fallbackLabel={fallbackLabel} tone={tone} badge={badge} background={placeholderBackground} />
      )}
      {hasFile && slot.kind === 'image' && (
        <Box
          component="img"
          src={cloudinaryWidth(slot.mediaUrl as string, 1200)}
          srcSet={imageSrcSet(slot.mediaUrl as string)}
          sizes={sizes}
          alt={slot.alt}
          width={slot.width}
          height={slot.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          data-slot-state="image"
          sx={{ ...fillImage, position: 'absolute', inset: 0 }}
        />
      )}
      {hasFile && slot.kind === 'video' && <VideoPlayer slot={slot} eager={eager} sizes={sizes} />}
    </Box>
  );
}
