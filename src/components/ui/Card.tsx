import { Card as MuiCard, CardProps as MuiCardProps, CardContent, CardActions } from '@mui/material';
import { styled } from '@mui/material/styles';

interface CardProps extends MuiCardProps {
  variant?: 'default' | 'outlined' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  actions?: React.ReactNode;
}

const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => !['variant', 'padding'].includes(prop as string),
})<CardProps>(({ theme, variant: cardVariant }) => ({
  borderRadius: (theme.shape.borderRadius ?? 8) * 1.5,
  transition: `all ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,

  ...(cardVariant === 'default' && {
    boxShadow: theme.shadows[1],
    border: `1px solid ${theme.palette.divider}`,
  }),

  ...(cardVariant === 'outlined' && {
    boxShadow: 'none',
    border: `1px solid ${theme.palette.divider}`,
  }),

  ...(cardVariant === 'elevated' && {
    boxShadow: theme.shadows[4],
    border: 'none',
  }),

  ...(cardVariant === 'interactive' && {
    cursor: 'pointer',
    boxShadow: theme.shadows[1],
    border: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      boxShadow: theme.shadows[4],
      transform: 'translateY(-2px)',
      borderColor: theme.palette.primary.main,
    },
    '&:active': { transform: 'translateY(0)' },
  }),
}));

const paddingMap: Record<string, number> = {
  none: 0,
  sm: 2,
  md: 3,
  lg: 4,
};

export default function Card({
  variant = 'default',
  padding = 'md',
  header,
  actions,
  children,
  ...props
}: CardProps) {
  return (
    <StyledCard variant={variant} {...props}>
      {header && (
        <CardContent sx={{ pb: 0, '&:last-child': { pb: 0 } }}>
          {header}
        </CardContent>
      )}
      <CardContent sx={{ p: paddingMap[padding], '&:last-child': { pb: paddingMap[padding] } }}>
        {children}
      </CardContent>
      {actions && (
        <CardActions sx={{ p: paddingMap[padding], pt: 0 }}>
          {actions}
        </CardActions>
      )}
    </StyledCard>
  );
}
