/* ══════════════════════════════════════════════════════════════
   RICH TEXT OF A SLOT — paragraphs, small headings, lists, bold

   The admin edits a text slot as plain text. Longer texts (the FAQ answers, the legal pages) need a little
   structure, so a slot may contain:
     • a blank line            → a new paragraph (a line break inside stays a line break)
     • "### Heading"           → a small heading
     • "- item" / "* item"     → a list item
     • **bold**                → bold
   and the tokens "{email}", "{telefon}", "{adresa}", "{pocet}" which a page fills from the clinic's
   settings — a contact detail or a number is never typed into a text.
   Nothing here is HTML: the text is parsed into React nodes, so a slot cannot inject markup.
   ══════════════════════════════════════════════════════════════ */

import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useSlotText } from '../../../site/SlotText';
import { FONT_HEAD, W } from '../../tokens';

export type TextBlock =
  | { kind: 'p'; lines: string[] }
  | { kind: 'h'; text: string }
  | { kind: 'ul'; items: string[] };

const HEADING = /^#{2,4}\s+(.*\S)\s*$/;
const BULLET = /^[-*•]\s+(.*\S)\s*$/;

/** Text → blocks. Pure, so it can be tested without React. */
export function parseBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'p', lines: paragraph });
    if (list.length > 0) blocks.push({ kind: 'ul', items: list });
    paragraph = [];
    list = [];
  };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') { flush(); continue; }
    const heading = HEADING.exec(line);
    if (heading !== null) { flush(); blocks.push({ kind: 'h', text: heading[1] }); continue; }
    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      if (paragraph.length > 0) { blocks.push({ kind: 'p', lines: paragraph }); paragraph = []; }
      list.push(bullet[1]);
      continue;
    }
    if (list.length > 0) { blocks.push({ kind: 'ul', items: list }); list = []; }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** "{email}" → the value; a token without a value is left as it is. */
export function fillTokens(text: string, tokens: Readonly<Record<string, string>>): string {
  return text.replace(/\{([a-z]+)\}/g, (whole, name: string) => (name in tokens && tokens[name] !== '' ? tokens[name] : whole));
}

function Inline({ text }: { text: string }): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <Fragment key={index}>{part}</Fragment>));
}

export interface RichTextProps {
  text: string;
  tokens?: Readonly<Record<string, string>>;
  /** The tag of "### …" headings — one level under the section's own heading. */
  headingTag?: 'h3' | 'h4';
  color?: string;
  sx?: SxProps<Theme>;
}

export function RichText({ text, tokens = {}, headingTag = 'h3', color = W.body, sx }: RichTextProps) {
  const blocks = parseBlocks(fillTokens(text, tokens));
  return (
    <Box sx={[{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: 16, lineHeight: 1.7, color, maxWidth: '72ch', minWidth: 0, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx !== undefined ? [sx] : [])]}>
      {blocks.map((block, index) => {
        if (block.kind === 'h') {
          return (
            <Box key={index} component={headingTag} sx={{ m: 0, mt: index > 0 ? '6px' : 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18, lineHeight: 1.3, color: W.text }}>
              <Inline text={block.text} />
            </Box>
          );
        }
        if (block.kind === 'ul') {
          return (
            <Box key={index} component="ul" sx={{ m: 0, pl: '22px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}><Inline text={item} /></li>
              ))}
            </Box>
          );
        }
        return (
          <Box key={index} component="p" sx={{ m: 0 }}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Inline text={line} />
              </Fragment>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

/** A text slot, rendered as rich text. */
export function RichSlotText({ slotKey, ...rest }: { slotKey: string } & Omit<RichTextProps, 'text'>) {
  const text = useSlotText(slotKey);
  return <RichText text={text} {...rest} />;
}
