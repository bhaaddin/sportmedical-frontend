import { ReactNode } from 'react';
import {
  Box, InputLabel, FormHelperText,
  Switch, SwitchProps, FormControl, FormControlLabel,
  Checkbox, Radio, RadioGroup, FormGroup
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Form Field wrapper
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  children: ReactNode;
  fullWidth?: boolean;
}

export function FormField({
  label,
  required = false,
  error = false,
  helperText,
  children,
  fullWidth = true,
}: FormFieldProps) {
  return (
    <Box sx={{ mb: 2, width: fullWidth ? '100%' : 'auto' }}>
      <InputLabel error={error} required={required} sx={{ mb: 0.5, fontWeight: 500 }}>
        {label}
      </InputLabel>
      {children}
      {helperText && (
        <FormHelperText error={error} sx={{ mt: 0.5, ml: 0 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
}

// Toggle Switch
interface ToggleProps extends Omit<SwitchProps, 'size'> {
  label: string;
  helperText?: string;
}

const StyledSwitch = styled(Switch)(({ theme }) => ({
  width: 42,
  height: 26,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 1,
    transitionDuration: '300ms',
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: theme.palette.primary.main,
        opacity: 1,
        border: 0,
      },
      '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.5 },
    },
    '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.3 },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 22,
    height: 22,
  },
  '& .MuiSwitch-track': {
    borderRadius: 26 / 2,
    backgroundColor: theme.palette.mode === 'light' ? '#E9E9EA' : '#39393D',
    opacity: 1,
    transition: theme.transitions.create(['background-color'], { duration: 500 }),
  },
}));

export function Toggle({ label, helperText, ...props }: ToggleProps) {
  return (
    <FormControl component="fieldset" variant="standard">
      <FormControlLabel
        control={<StyledSwitch {...props} />}
        label={
          <Box>
            <InputLabel sx={{ fontWeight: 500 }}>{label}</InputLabel>
            {helperText && (
              <FormHelperText sx={{ mt: 0 }}>{helperText}</FormHelperText>
            )}
          </Box>
        }
      />
    </FormControl>
  );
}

// Checkbox Group
interface CheckboxGroupProps {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: boolean;
  helperText?: string;
}

export function CheckboxGroup({
  label,
  options,
  value,
  onChange,
  error = false,
  helperText,
}: CheckboxGroupProps) {
  const handleChange = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <Box sx={{ mb: 2 }}>
      <InputLabel error={error} sx={{ mb: 1, fontWeight: 500 }}>
        {label}
      </InputLabel>
      <FormGroup>
        {options.map(option => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={value.includes(option.value)}
                onChange={() => handleChange(option.value)}
              />
            }
            label={option.label}
          />
        ))}
      </FormGroup>
      {helperText && <FormHelperText error={error}>{helperText}</FormHelperText>}
    </Box>
  );
}

// Radio Group
interface RadioGroupFieldProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  row?: boolean;
  error?: boolean;
  helperText?: string;
}

export function RadioGroupField({
  label,
  options,
  value,
  onChange,
  row = false,
  error = false,
  helperText,
}: RadioGroupFieldProps) {
  return (
    <FormControl component="fieldset" error={error} sx={{ mb: 2 }}>
      <InputLabel sx={{ fontWeight: 500 }}>{label}</InputLabel>
      <RadioGroup
        row={row}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ mt: 1 }}
      >
        {options.map(option => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio />}
            label={option.label}
          />
        ))}
      </RadioGroup>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
