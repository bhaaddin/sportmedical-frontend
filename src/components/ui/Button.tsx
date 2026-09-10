import { Button as MuiButton, type ButtonProps as MuiButtonProps } from '@mui/material';
import { styled } from '@mui/material/styles';

interface ButtonProps extends MuiButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const StyledButton = styled(MuiButton, {
  shouldForwardProp: (prop) =>
    !['loading', 'iconPosition'].includes(prop as string),
})<ButtonProps>(({ theme, variant: buttonVariant, size, loading }) => ({
  position: 'relative',
  fontWeight: 500,
  borderRadius: theme.shape.borderRadius,
  transition: `all ${theme.transitions.duration.standard}ms ${theme.transitions.easing.easeOut}`,

  ...(size === 'xs' && {
    padding: '4px 8px',
    fontSize: '0.75rem',
    minHeight: 28,
  }),
  ...(size === 'sm' && {
    padding: '6px 12px',
    fontSize: '0.8125rem',
    minHeight: 32,
  }),
  ...(size === 'md' && {
    padding: '8px 16px',
    fontSize: '0.875rem',
    minHeight: 40,
  }),
  ...(size === 'lg' && {
    padding: '12px 24px',
    fontSize: '1rem',
    minHeight: 48,
  }),

  ...(buttonVariant === 'primary' && {
    backgroundColor: theme.palette.primary.main,
    color: '#FFFFFF',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      transform: 'translateY(-1px)',
      boxShadow: theme.shadows[4],
    },
    '&:active': { transform: 'translateY(0)' },
  }),

  ...(buttonVariant === 'secondary' && {
    backgroundColor: 'transparent',
    color: theme.palette.primary.main,
    border: `2px solid ${theme.palette.primary.main}`,
    '&:hover': {
      backgroundColor: theme.palette.primary.main + '10',
      transform: 'translateY(-1px)',
    },
  }),

  ...(buttonVariant === 'danger' && {
    backgroundColor: theme.palette.error.main,
    color: '#FFFFFF',
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
      transform: 'translateY(-1px)',
      boxShadow: theme.shadows[4],
    },
  }),

  ...(buttonVariant === 'ghost' && {
    backgroundColor: 'transparent',
    color: theme.palette.text.primary,
    '&:hover': { backgroundColor: theme.palette.action?.hover },
  }),

  ...(buttonVariant === 'link' && {
    backgroundColor: 'transparent',
    color: theme.palette.primary.main,
    padding: 0,
    minHeight: 'auto',
    '&:hover': { textDecoration: 'underline' },
  }),

  ...(loading && {
    color: 'transparent',
    pointerEvents: 'none',
    '&::after': {
      content: '""',
      position: 'absolute',
      width: 16,
      height: 16,
      border: `2px solid ${theme.palette.primary.contrastText || '#FFFFFF'}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      top: '50%',
      left: '50%',
      marginTop: -8,
      marginLeft: -8,
    },
  }),

  '&.Mui-disabled': { opacity: 0.5, pointerEvents: 'none' },

  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
}));

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  children,
  ...props
}: ButtonProps) {
  return (
    <StyledButton
      variant={variant === 'ghost' || variant === 'link' ? 'text' : 'contained'}
      size={size === 'xs' ? 'small' : size === 'lg' ? 'large' : 'medium'}
      loading={loading}
      startIcon={iconPosition === 'left' ? icon : undefined}
      endIcon={iconPosition === 'right' ? icon : undefined}
      disabled={loading || props.disabled}
      {...props}
    >
      {children}
    </StyledButton>
  );
}
