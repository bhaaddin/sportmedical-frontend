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
          return {
            position: 'relative',
            flex: 'none',
            width: size,
            height: size,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: `conic-gradient(${arc} 0deg, ${arc} ${pct * 3.6}deg, ${dark ? '#315D76' : t.palette.divider} ${pct * 3.6}deg 360deg)`,
            boxShadow: dark ? `0 0 17px ${t.palette.primary.main}33` : 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: Math.max(6, Math.round(size * 0.12)),
              borderRadius: '50%',
              background: t.palette.background.paper,
              boxShadow: dark ? 'inset 0 0 8px #102F4C' : 'none',
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
