/*
 * The command palette: one box that finds a patient, a club, an order, an invoice, a service, a settings screen or an
 * action ("Nová objednávka"), and opens it. Ctrl/Cmd+K or any search button opens it; the arrows move, Enter opens,
 * Esc closes. The ranking is `commandModel`, the data `useCommandSearch`; this file only draws and listens.
 *
 * It is a lazy chunk: `components/UniversalSearch.tsx` (which the shell imports) holds the shortcut and loads this file
 * the first time somebody asks, so no first load carries it.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Dialog, InputBase, Typography } from '@mui/material';
import { ArrowForward, Bolt, ContentPasteSearch, Search, Settings, Window } from '@mui/icons-material';
import { useIsPhone } from '../../../layout/useDevice';
import { EntityBadge } from '../entityMeta';
import { rememberOpened } from '../memory';
import { MUTED_SX, toneOf } from '../shelfStyle';
import { darkOf } from '../../../theme';
import { flatten, moveIndex, resolveState, type Command, type CommandSection } from './commandModel';
import { useCommandSearch } from './useCommandSearch';

const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

function CommandIcon({ command }: { command: Command }) {
  if (command.entity !== undefined) return <EntityBadge kind={command.entity.kind} size={30} />;
  const Icon = command.group === 'action' ? Bolt : command.group === 'settings' ? Settings : Window;
  return (
    <Box
      aria-hidden
      sx={(t) => {
        const c = toneOf(t, command.group === 'action' ? 'primary' : 'grey');
        return { width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, color: c.fg, bgcolor: c.bg, boxShadow: `inset 0 0 0 1px ${c.line}` };
      }}
    >
      <Icon sx={{ fontSize: 17 }} />
    </Box>
  );
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const phone = useIsPhone();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const search = useCommandSearch(query, open);
  const flat = useMemo(() => flatten(search.sections), [search.sections]);

  /* A fresh palette every time it opens. */
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  /* The field has the focus every time the palette opens. `autoFocus` alone only works the first time: on a later open the
     dialog's own focus trap got there first, and a Ctrl+K - Enter would have gone to the dialog and opened nothing. The field
     is inside a portal that mounts after this effect, so it is asked for a few frames. */
  useEffect(() => {
    if (!open) return undefined;
    let tries = 0;
    let frame = 0;
    const focus = () => {
      const field = inputRef.current;
      if (field !== null) {
        field.focus();
        if (document.activeElement === field) return;
      }
      tries += 1;
      if (tries < 12) frame = requestAnimationFrame(focus);
    };
    frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  /* The first row is the active one whenever the list changes under the typing. */
  useEffect(() => { setActive(0); }, [query]);

  /* Keep the active row in view when the arrows walk past the edge of the list. */
  useEffect(() => {
    const el = document.getElementById(`${listId}-${active}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active, listId]);

  const run = (command: Command) => {
    /* Pins and recents learn what the person actually opened (never an appointment: it has no page of its own). */
    if (command.entity !== undefined && command.entity.kind !== 'appointment') rememberOpened(command.entity);
    onClose();
    navigate(command.to, { state: resolveState(command.state) });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => moveIndex(i, 1, flat.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => moveIndex(i, -1, flat.length)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, flat.length - 1)); }
    else if (e.key === 'Enter') {
      const command = flat[active];
      if (command !== undefined) { e.preventDefault(); run(command); }
    }
  };

  /* The row number of a command in the flat order the arrow keys walk. */
  const indexOfCommand = new Map(flat.map((c, i) => [c.id, i]));
  const renderSection = (section: CommandSection) => (
    <Box key={section.id} role="group" aria-labelledby={`${listId}-h-${section.id}`} sx={{ pb: 0.5 }}>
      <Typography id={`${listId}-h-${section.id}`} sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', ...MUTED_SX }}>
        {section.title}
      </Typography>
      {section.commands.map((command) => {
        const index = indexOfCommand.get(command.id) ?? 0;
        const selected = index === active;
        return (
          <Box
            key={command.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={selected}
            data-command={command.id}
            onMouseMove={() => { if (!selected) setActive(index); }}
            onClick={() => run(command)}
            sx={(t) => ({
              display: 'flex', alignItems: 'center', gap: 1.25, mx: 1, px: 1, minHeight: 48, borderRadius: 1.5, cursor: 'pointer',
              bgcolor: selected ? toneOf(t, 'primary').bg : 'transparent',
              boxShadow: selected ? `inset 0 0 0 1px ${toneOf(t, 'primary').line}` : 'none',
            })}
          >
            <CommandIcon command={command} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 650, lineHeight: 1.3 }}>{command.label}</Typography>
              {command.hint !== undefined && <Typography noWrap sx={{ ...MUTED_SX, fontSize: 12.5, lineHeight: 1.3 }}>{command.hint}</Typography>}
            </Box>
            {selected && <ArrowForward aria-hidden sx={{ fontSize: 17, color: 'text.secondary', flexShrink: 0 }} />}
          </Box>
        );
      })}
    </Box>
  );

  const activeId = flat[active] !== undefined ? `${listId}-${active}` : undefined;
  const noAnswer = !search.idle && !search.busy && flat.length === 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={phone}
      aria-label="Hledání a příkazy"
      slotProps={{
        paper: {
          sx: (t) => ({
            borderRadius: phone ? 0 : '18px', overflow: 'hidden', alignSelf: phone ? 'stretch' : 'flex-start', mt: phone ? 0 : '12vh',
            border: phone ? 0 : '1px solid', borderColor: t.palette.mode === 'dark' ? darkOf(t).panelLine : t.palette.divider,
          }),
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, minHeight: 56, borderBottom: '1px solid', borderColor: 'divider' }}>
        {search.busy ? <CircularProgress size={18} aria-label="Hledám" /> : <Search sx={{ color: 'text.secondary', fontSize: 20 }} />}
        <InputBase
          autoFocus
          inputRef={inputRef}
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pacient, klub, faktura, stránka nebo akce…"
          autoComplete="off"
          inputProps={{
            'aria-label': 'Hledat',
            role: 'combobox',
            'aria-expanded': flat.length > 0,
            'aria-controls': listId,
            'aria-activedescendant': activeId,
            'aria-autocomplete': 'list',
            spellCheck: false,
            style: { fontSize: 16, minHeight: 44 },
          }}
        />
        {!phone && (
          <Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 700, px: 0.75, py: 0.25, borderRadius: 0.75, border: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>Esc</Box>
        )}
      </Box>

      <Box id={listId} role="listbox" aria-label="Výsledky" sx={{ maxHeight: phone ? 'none' : 'min(56dvh, 460px)', flex: phone ? 1 : undefined, overflowY: 'auto', overscrollBehavior: 'contain', py: 0.5 }}>
        {search.sections.map(renderSection)}
        {noAnswer && (
          <Box role="status" sx={{ p: 3, textAlign: 'center' }}>
            <ContentPasteSearch sx={{ fontSize: 28, color: 'text.secondary' }} />
            <Typography sx={{ fontWeight: 650, mt: 0.5 }}>Nic jsme nenašli pro „{query.trim()}“</Typography>
            <Typography sx={{ ...MUTED_SX, fontSize: 13, mt: 0.5 }}>
              {search.withheld
                ? 'Podle rodného ani pojišťovacího čísla se nehledá. Zkuste jméno nebo příjmení.'
                : 'Zkuste jméno, příjmení, název klubu nebo číslo faktury.'}
            </Typography>
          </Box>
        )}
      </Box>

      {!phone && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, minHeight: 40, borderTop: '1px solid', borderColor: 'divider', ...MUTED_SX, fontSize: 12 }} aria-hidden>
          <span>↑↓ vybrat</span>
          <span>↵ otevřít</span>
          <span>Esc zavřít</span>
          <Box sx={{ flex: 1 }} />
          <span>{isMac() ? '⌘ K' : 'Ctrl K'}</span>
        </Box>
      )}
    </Dialog>
  );
}
