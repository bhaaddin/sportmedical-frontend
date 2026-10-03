import type { Theme } from '@mui/material';
import type { SystemStyleObject } from '@mui/system';

/**
 * On a phone nothing a finger has to hit is under 44 px (brief, rule 3).
 *
 * Applied to the root of a registration screen when `useIsPhone()` is true, so
 * the buttons, toggle buttons, inputs, selects and checkboxes inside it grow
 * without every one of them carrying its own `sx`.
 */
export const PHONE_TOUCH_TARGETS: SystemStyleObject<Theme> = {
  '& .MuiButton-root, & .MuiToggleButton-root, & .MuiIconButton-root': {
    minHeight: 44,
    minWidth: 44,
  },
  '& .MuiInputBase-root': { minHeight: 44 },
  '& .MuiCheckbox-root': { p: '10px' },
  '& .MuiFormControlLabel-root': { minHeight: 44 },
  '& .MuiAutocomplete-root .MuiInputBase-root': { minHeight: 44 },
};
