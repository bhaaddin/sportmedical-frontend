/*
 * A rendered e-mail, shown the way the recipient gets it. The body is a whole branded HTML document written by the clinic
 * (or by us) with sample or real values, so it goes into an empty-sandbox iframe: no script, no form, no navigation.
 */
import { Box } from '@mui/material';

export function HtmlPreview({ html, title = 'Náhled e-mailu', height = 360, dark = false }: { html: string; title?: string; height?: number | string; dark?: boolean }) {
  return (
    <Box
      component="iframe"
      title={title}
      srcDoc={html}
      sandbox=""
      sx={{ display: 'block', width: '100%', height, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: dark ? '#000C17' : 'common.white' }}
    />
  );
}
