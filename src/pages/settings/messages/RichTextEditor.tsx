/*
 * Writing a message like in Word: a toolbar (bold, italic, heading, lists, link/button, undo), the text itself, and the
 * placeholders as coloured chips. `singleLine` is the same box without a toolbar for the subject. The parent inserts a
 * placeholder through the handle, at the caret of whichever box was last used.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { TARGET_SX } from '../../../ui/shelf';
import { chipHtml, fromEditorHtml, fromEditorText, placeholderLabel, textToEditorHtml, toEditorHtml } from './richText';
import type { PlaceholderInfo } from './richText';

export interface RichTextHandle {
  insertPlaceholder: (key: string) => void;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholders: readonly PlaceholderInfo[];
  singleLine?: boolean;
  onFocus?: () => void;
}

const CHIP_SX = {
  '& .sm-ph': {
    display: 'inline-block', px: 1, py: '1px', mx: '2px', borderRadius: 999, fontSize: '0.85em', fontWeight: 600,
    bgcolor: 'primary.main', color: 'primary.contrastText', userSelect: 'all', whiteSpace: 'nowrap', verticalAlign: 'baseline',
  },
} as const;

/** `document.execCommand` is old but is still what every browser's editing box answers to; nothing else does this without a library. */
function run(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export const RichTextEditor = forwardRef<RichTextHandle, Props>(function RichTextEditor(
  { label, value, onChange, placeholders, singleLine = false, onFocus },
  ref,
) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  /* Only an outside change (load, reset) rewrites the box; the person's own typing never does, so the caret stays put. */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || value === lastEmitted.current) return;
    el.innerHTML = singleLine ? textToEditorHtml(value, placeholders) : toEditorHtml(value, placeholders);
    lastEmitted.current = value;
  }, [value, placeholders, singleLine]);

  /* Wherever the caret goes inside the box - typing, clicking, arrow keys - is where a chip or a button lands later. */
  useEffect(() => {
    const track = () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && boxRef.current?.contains(selection.anchorNode)) {
        savedRange.current = selection.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', track);
    return () => document.removeEventListener('selectionchange', track);
  }, []);

  const emit = () => {
    const el = boxRef.current;
    if (!el) return;
    const next = singleLine ? fromEditorText(el.innerHTML) : fromEditorHtml(el.innerHTML);
    lastEmitted.current = next;
    onChange(next);
  };

  const rememberCaret = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && boxRef.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreCaret = () => {
    const el = boxRef.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    if (savedRange.current) {
      selection.addRange(savedRange.current);
    } else {
      const end = document.createRange();
      end.selectNodeContents(el);
      end.collapse(false);
      selection.addRange(end);
    }
  };

  const command = (name: string, arg?: string) => {
    restoreCaret();
    run(name, arg);
    emit();
    rememberCaret();
  };

  /*
   * Puts `html` exactly at the caret. The browser's own insertHTML drops it after the paragraph when the caret sits at
   * a paragraph's very end, so the range is placed by hand: a caret between two paragraphs goes to the end of the one before.
   */
  const insertAtCaret = (html: string) => {
    const el = boxRef.current;
    if (!el) return;
    restoreCaret();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.startContainer === el && !singleLine) {
      const before = el.childNodes[range.startOffset - 1];
      if (before instanceof HTMLElement) {
        range.selectNodeContents(before);
        range.collapse(false);
      }
    }
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    emit();
    rememberCaret();
  };

  useImperativeHandle(ref, () => ({
    insertPlaceholder: (key: string) => {
      const info = placeholders.find((p) => p.key === key);
      insertAtCaret(`${chipHtml(key, placeholderLabel(key, info?.description))}&nbsp;`);
    },
  }));

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    /* Pasted Word or web text brings fonts and colours that fight the e-mail's design; the words are what matter. */
    event.preventDefault();
    run('insertText', event.clipboardData.getData('text/plain'));
    emit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (singleLine && event.key === 'Enter') event.preventDefault();
  };

  const urlPlaceholders = placeholders.filter((p) => p.key.startsWith('odkaz.') && !p.key.endsWith('_html'));

  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{label}</Typography>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:focus-within': { borderColor: 'primary.main' } }}>
        {singleLine ? null : (
          <Stack
            direction="row"
            spacing={0.25}
            useFlexGap
            sx={{ flexWrap: 'wrap', px: 0.5, py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}
            role="toolbar"
            aria-label="Úprava textu"
          >
            <Tool title="Tučně" onClick={() => command('bold')}><Glyph bold>B</Glyph></Tool>
            <Tool title="Kurzíva" onClick={() => command('italic')}><Glyph italic>I</Glyph></Tool>
            <Tool title="Podtržení" onClick={() => command('underline')}><Glyph underline>U</Glyph></Tool>
            <Tool title="Nadpis" onClick={() => command('formatBlock', '<h2>')}><Glyph bold>H</Glyph></Tool>
            <Tool title="Obyčejný text" onClick={() => command('formatBlock', '<p>')}><Glyph>¶</Glyph></Tool>
            <Tool title="Odrážky" onClick={() => command('insertUnorderedList')}><Glyph>•</Glyph></Tool>
            <Tool title="Číslovaný seznam" onClick={() => command('insertOrderedList')}><Glyph>1.</Glyph></Tool>
            <Tool title="Tlačítko / odkaz" onClick={() => { rememberCaret(); setLinkOpen(true); }}><Glyph bold>⇢</Glyph></Tool>
            <Tool title="Oddělovací čára" onClick={() => command('insertHorizontalRule')}><Glyph>—</Glyph></Tool>
            <Tool title="Zpět" onClick={() => command('undo')}><Glyph>↶</Glyph></Tool>
            <Tool title="Znovu" onClick={() => command('redo')}><Glyph>↷</Glyph></Tool>
          </Stack>
        )}
        <Box
          ref={boxRef}
          role="textbox"
          aria-label={label}
          aria-multiline={!singleLine}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { emit(); rememberCaret(); }}
          onBlur={() => { rememberCaret(); emit(); }}
          onKeyUp={rememberCaret}
          onMouseUp={rememberCaret}
          onFocus={onFocus}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          sx={{
            ...CHIP_SX,
            outline: 'none',
            px: 1.5,
            py: singleLine ? 1.25 : 1.5,
            minHeight: singleLine ? 44 : 220,
            maxHeight: singleLine ? undefined : 420,
            overflowY: 'auto',
            fontSize: 15,
            lineHeight: 1.6,
            '& p': { m: 0, mb: 1 },
            '& h2': { fontSize: 20, m: 0, mb: 1 },
            '& a': { color: 'primary.main', fontWeight: 600 },
          }}
        />
      </Box>
      {linkOpen ? (
        <LinkDialog
          urlPlaceholders={urlPlaceholders}
          onClose={() => setLinkOpen(false)}
          onInsert={(text, href) => {
            setLinkOpen(false);
            const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeHref = href.replace(/"/g, '&quot;');
            insertAtCaret(`<a href="${safeHref}">${safeText}</a>&nbsp;`);
          }}
        />
      ) : null}
    </Box>
  );
});

/** A toolbar letter instead of an icon: the icon set would land in a chunk the calendar also loads. */
function Glyph({ children, bold, italic, underline }: { children: ReactNode; bold?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <Box component="span" sx={{ fontSize: 17, lineHeight: 1, fontWeight: bold ? 800 : 600, fontStyle: italic ? 'italic' : undefined, textDecoration: underline ? 'underline' : undefined, minWidth: 18, textAlign: 'center' }}>
      {children}
    </Box>
  );
}

function Tool({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title={title}>
      {/* mousedown would steal the caret from the text before the click lands */}
      <IconButton aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} sx={{ minWidth: 44, minHeight: 44 }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

const OWN = '__own__';

function LinkDialog({ urlPlaceholders, onClose, onInsert }: {
  urlPlaceholders: readonly PlaceholderInfo[];
  onClose: () => void;
  onInsert: (text: string, href: string) => void;
}) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState(urlPlaceholders[0]?.key ?? OWN);
  const [url, setUrl] = useState('https://');
  const href = target === OWN ? url.trim() : `{{${target}}}`;
  const valid = text.trim() !== '' && (target !== OWN || /^(https?:\/\/\S+|mailto:\S+|tel:\S+)$/i.test(href));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Tlačítko v e-mailu</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Text tlačítka" placeholder="např. Zobrazit rezervaci" value={text} onChange={(e) => setText(e.target.value)} autoFocus fullWidth />
          <TextField select label="Kam vede" value={target} onChange={(e) => setTarget(e.target.value)} fullWidth>
            {urlPlaceholders.map((p) => (
              <MenuItem key={p.key} value={p.key} sx={{ minHeight: 44 }}>{placeholderLabel(p.key, p.description)}</MenuItem>
            ))}
            <MenuItem value={OWN} sx={{ minHeight: 44 }}>Vlastní webová adresa</MenuItem>
          </TextField>
          {target === OWN ? (
            <TextField label="Webová adresa" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={TARGET_SX}>Zrušit</Button>
        <Button variant="contained" disabled={!valid} onClick={() => onInsert(text.trim(), href)} sx={TARGET_SX}>Vložit</Button>
      </DialogActions>
    </Dialog>
  );
}
