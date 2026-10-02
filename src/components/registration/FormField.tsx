import { useId } from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';

/**
 * The board's field: a small uppercase label OVER the input (JMÉNO A PŘÍJMENÍ,
 * TELEFON, E-MAIL), never a floating MUI label inside it. The input itself is
 * whatever the caller renders - a TextField with no `label`, a picker - and it
 * receives the `id` this component mints, so the label stays attached and
 * `getByLabelText` keeps working.
 *
 * `name` is the registration field the box holds, written as `data-field` so
 * the page can scroll to the first thing that is wrong.
 *
 * A select cannot be reached through `htmlFor` (its display is a div), so the
 * label also carries the id `${id}-label` for the select's `labelId`.
 */
export function FormField({
  label,
  required = false,
  name,
  children,
  sx,
}: {
  label: React.ReactNode;
  required?: boolean;
  name?: string;
  children: (id: string) => React.ReactNode;
  sx?: SxProps<Theme>;
}) {
  const id = useId();

  return (
    <Box data-field={name} sx={sx}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25, mb: 0.75 }}>
        <Typography
          component="label"
          id={`${id}-label`}
          htmlFor={id}
          variant="overline"
          sx={{ color: 'text.secondary' }}
        >
          {label}
        </Typography>
        {/* Outside the label on purpose: the label's text stays the field's name. */}
        {required && (
          <Typography component="span" aria-hidden variant="overline" sx={{ color: 'error.main' }}>
            *
          </Typography>
        )}
      </Box>
      {children(id)}
    </Box>
  );
}

export default FormField;
