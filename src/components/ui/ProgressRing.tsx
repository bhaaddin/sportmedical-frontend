import { accentLiteral } from '../../theme';
import { Box, type SxProps, type Theme } from '@mui/material';

/**
 * The planner prototype's progress ring (`.oc-progress`): a conic arc over a
 * sunk disc with the percentage in the middle. Decorative restatement of a
 * number the screen already prints, so it is exposed as one labelled image.
 * `tone` defaults to the theme's primary (cyan in dark, the accent in light).
 */
export function ProgressRing({
  value,
  size = 76,
  label,
  tone,
  sx,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  /** What the ring counts, for assistive technology ("Zapsáno"). */
  label: string;
  /** A CSS colour for the arc; omitted = the theme's primary. */
  tone?: string;
  sx?: SxProps<Theme>;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const rounded = Math.round(pct);
  return (
    <Box
      role="img"
      aria-label={`${label}: ${rounded} %`}
      data-testid="progress-ring"
      sx={[
        (t: Theme) => {
          const dark = t.palette.mode === 'dark';
          const arc = tone ?? (dark ? t.palette.primary.light : t.palette.primary.main);
          /* The prototype's `.s42-ring`: a light-aqua to sky arc over a slate track, a hairline halo, a sunk navy disc. */
          const from = dark && tone === undefined ? 'from -90deg, ' : '';
          const fill = tone === undefined && dark ? `${accentLiteral(t, '#9CFFF3')} 0deg, ${accentLiteral(t, '#78DDFC')} ${pct * 3.6}deg` : `${arc} 0deg, ${arc} ${pct * 3.6}deg`;
          return {
            position: 'relative',
            flex: 'none',
            width: size,
            height: size,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: `conic-gradient(${from}${fill}, ${dark ? `#273D54 ${pct * 3.6}deg, #263A50 360deg` : `${t.palette.divider} ${pct * 3.6}deg 360deg`})`,
            boxShadow: dark ? accentLiteral(t, '0 0 0 1px rgba(171, 237, 255, 0.31), 0 0 14px rgba(75, 219, 239, 0.17), inset 0 0 8px rgba(130, 249, 238, 0.1)') : 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              /* `.s42-ring::before` is inset 12px of 70px. */
              inset: Math.max(6, Math.round(size * (dark ? 12 / 70 : 0.12))),
              borderRadius: '50%',
              background: dark ? '#031425' : t.palette.background.paper,
              boxShadow: dark ? 'inset 0 0 12px rgba(0, 0, 0, 0.8), 0 0 5px #061E2D' : 'none',
            },
          };
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{ position: 'relative', zIndex: 1, fontWeight: 800, fontSize: Math.round(size * 0.26), letterSpacing: '-0.02em', lineHeight: 1 }}
      >
        {rounded} %
      </Box>
    </Box>
  );
}

export default ProgressRing;
