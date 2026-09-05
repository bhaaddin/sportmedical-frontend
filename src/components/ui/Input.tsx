import { TextField, TextFieldProps, InputAdornment } from '@mui/material';
import { styled } from '@mui/material/styles';

interface InputProps extends TextFieldProps {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

const StyledTextField = styled(TextField)<InputProps>(({ theme, error }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    transition: `all ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeOut}`,

    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: error ? theme.palette.error.main : theme.palette.primary.light,
      },
    },

    '&.Mui-focused': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: error ? theme.palette.error.main : theme.palette.primary.main,
        borderWidth: 2,
      },
      boxShadow: `0 0 0 3px ${error ? theme.palette.error.main : theme.palette.primary.main}15`,
    },
  },

  '& .MuiInputLabel-root': {
    fontWeight: 500,
    '&.Mui-focused': {
      color: error ? theme.palette.error.main : theme.palette.primary.main,
    },
  },

  '& .MuiFormHelperText-root': {
    marginLeft: 4,
    fontSize: '0.75rem',
  },
}));

export default function Input({
  variant = 'outlined',
  size = 'medium',
  error = false,
  helperText,
  startIcon,
  endIcon,
  ...props
}: InputProps) {
  return (
    <StyledTextField
      variant={variant}
      size={size}
      error={error}
      helperText={helperText}
      InputProps={{
        startAdornment: startIcon ? (
          <InputAdornment position="start">{startIcon}</InputAdornment>
        ) : undefined,
        endAdornment: endIcon ? (
          <InputAdornment position="end">{endIcon}</InputAdornment>
        ) : undefined,
      }}
      {...props}
    />
  );
}
