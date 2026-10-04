/*
 * "Odkaz pro hráče a rodiče": the absolute registration link of a confirmed order with a one-click copy.
 * The base is this app's own origin (a public page must not call the staff settings API).
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { absoluteLink } from '../../../components/clubs/orders/absoluteLink';
import { BRAND } from '../../../components/public/brand';
import { Panel, PanelTitle, SOFT_TEXT, ctaSx } from '../../../components/public/kit';

export interface LinkCardTexts {
  title: string;
  text: string;
  copy: string;
  copied: string;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function LinkCard({ path, t }: { path: string; t: LinkCardTexts }) {
  const url = absoluteLink(path);
  const [copied, setCopied] = useState(false);
  if (url === '') return null;
  return (
    <Panel labelledBy="club-order-link-title" sx={{ border: `2px solid ${BRAND.accent}` }}>
      <PanelTitle id="club-order-link-title">{t.title}</PanelTitle>
      <Typography sx={{ fontSize: 15.5, color: SOFT_TEXT, lineHeight: 1.55 }}>{t.text}</Typography>
      <Box
        component="input"
        readOnly
        aria-label={t.title}
        value={url}
        onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
        sx={{ width: '100%', boxSizing: 'border-box', p: '12px 14px', fontSize: 15, fontFamily: 'inherit', border: `1px solid ${BRAND.line}`, borderRadius: '10px', bgcolor: BRAND.page }}
      />
      <Button
        onClick={() => { void copyText(url).then((ok) => setCopied(ok)); }}
        sx={{ ...ctaSx(50), alignSelf: 'flex-start' }}
      >
        {copied ? t.copied : t.copy}
      </Button>
    </Panel>
  );
}
