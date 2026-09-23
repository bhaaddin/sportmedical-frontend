/* ══════════════════════════════════════════════════════════════
   ZDRAVOTNÍ DOTAZNÍK — the form itself

   Draws the questionnaire the registration page loaded for the booking — the
   one the booked činnost names, or the clinic's default — in the shapes
   `healthQuestionnaire.ts` defines. The page owns the fetch, because the
   submission has to say which questionnaire the answers belong to whether or
   not this dialog was ever opened; this file only draws what it is given.

   ── Why this takes the whole screen ──

   It did not, at first. It opened inside the registration page's left column,
   and the owner was blunt about the result: "the style looks fucking bad its a
   dezaster its not orgenized ... it looks small ... may lack to hold the
   pacient". Measured, he was right and it was not close: 504 px of form on a
   1432 px page, 7964 px tall — nine screens of a narrow orange strip with half
   the monitor empty beside it.

   A form of this length is not a section of another page. While somebody is
   filling it in it IS the task, so it takes the screen: a rail down the side
   that says how far along they are and lets them jump, a column wide enough for
   two questions abreast, and rows big enough to hit on a phone.

   The rail is the part that does the work. Seventy-six questions with no way to
   see the shape of them is what makes a form feel endless; twelve named
   sections with a count each makes the same form feel finite, which is the
   whole difference between finishing it and closing the tab.

   ── Where the answers go ──

   Into the browser as you type, and to the clinic with the registration:
   the page reads the same draft when it submits and sends it under the
   questionnaire's key and revision. The footer says exactly that — it used to
   say the answers went nowhere, which stopped being true the day the intake
   request grew a `healthQuestionnaire` field. The print button stays for
   whoever wants the filled-in form on paper.

   `localStorage` is a convenience that may simply not be there: a private
   window, blocked site data, or a thrown SecurityError all end with an empty
   form rather than a broken one.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckOutlined,
  CloseOutlined,
  CloudDoneOutlined,
  PrintOutlined,
} from '@mui/icons-material';
import {
  DECLARATION,
  RELATIVES,
  itemsFor,
  progressOf,
  sectionsFor,
} from '../../services/publicIntake/healthQuestionnaire';
import type { Answer, Answers, Field, Section } from '../../services/publicIntake/healthQuestionnaire';
import type { LoadedQuestionnaire } from '../../api/publicQuestionnaire';

const STORE_KEY = 'smd.health-questionnaire.draft.v1';

const load = (): Answers => {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Answers);
  } catch {
    /* Private window, blocked site data, or corrupted JSON. An empty form is a
       working form; a thrown error here would take the whole page down. */
    return {};
  }
};

const save = (answers: Answers): void => {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(answers));
  } catch {
    /* Quota, or storage that refuses to be written. Nothing to tell the patient:
       the answers are still on screen and still printable. */
  }
};

export interface Palette {
  ink: string;
  accent: string;
  accentDark: string;
  accentWash: string;
  accentEdge: string;
  line: string;
  muted: string;
}

export default function HealthQuestionnaire({
  open,
  onClose,
  female,
  palette,
  questionnaire,
  loadFailed,
}: {
  open: boolean;
  onClose: () => void;
  female: boolean;
  palette: Palette;
  /**
   * What to draw: the questionnaire the page loaded for the booking. Null
   * while it is on its way — or, with `loadFailed`, when it never came.
   */
  questionnaire: LoadedQuestionnaire | null;
  loadFailed: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(load);
  const [active, setActive] = useState<string>('');
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => { save(answers); }, [answers]);

  const sections = useMemo(
    () => sectionsFor(questionnaire?.sections ?? [], female),
    [questionnaire, female],
  );

  const set = useCallback(
    (id: string, value: Answer): void =>
      setAnswers((previous) => ({ ...previous, [id]: value })),
    [],
  );

  const totals = sections.reduce(
    (running, section) => {
      const { answered, total } = progressOf(section, answers);
      return { answered: running.answered + answered, total: running.total + total };
    },
    { answered: 0, total: 0 },
  );
  const percent = totals.total === 0 ? 0 : Math.round((totals.answered / totals.total) * 100);

  /*
   * Which section is on screen, so the rail can say where you are.
   *
   * The top fifth of the viewport is the line that decides. Watching the middle
   * would flip the highlight while somebody is still typing in the section
   * above, which reads as the page losing track of them.
   */
  useEffect(() => {
    if (!open) return undefined;
    const root = scroller.current;
    if (root === null) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0] !== undefined) setActive(visible[0].target.id.replace('smd-sec-', ''));
      },
      { root, rootMargin: '0px 0px -80% 0px', threshold: 0 },
    );

    root.querySelectorAll('[data-smd-section]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [open, sections, answers]);

  const jumpTo = (id: string): void => {
    const target = document.getElementById(`smd-sec-${id}`);
    if (target !== null) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      transitionDuration={220}
      slotProps={{ paper: { sx: { bgcolor: '#F4F4F6' } } }}
    >
      {/* ── Header ── */}
      <Box
        className="smd-no-print"
        sx={{
          bgcolor: palette.ink,
          color: '#FFFFFF',
          px: { xs: 2, md: 4 },
          pt: { xs: 2, md: 2.5 },
          pb: 0,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 21 }, letterSpacing: '-0.01em' }}>
              {questionnaire?.name ?? 'Zdravotní dotazník'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              Vyplněno {totals.answered} z {totals.total} — nic není povinné
            </Typography>
          </Box>
          <Chip
            label={`${percent} %`}
            sx={{ fontWeight: 800, bgcolor: palette.accent, color: palette.ink, fontSize: 14 }}
          />
          <IconButton onClick={onClose} sx={{ color: '#FFFFFF' }} aria-label="Zavřít dotazník">
            <CloseOutlined />
          </IconButton>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percent}
          sx={{
            height: 4,
            bgcolor: 'rgba(255,255,255,0.14)',
            '& .MuiLinearProgress-bar': { bgcolor: palette.accent },
          }}
        />
      </Box>

      {/* ── Body ── */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '270px 1fr' },
        }}
      >
        {/*
          The rail. Desktop only — on a phone the header's counter does the same
          job in the space available, and a list of twelve links above the form
          would just be one more thing to scroll past.
        */}
        <Box
          className="smd-no-print"
          sx={{
            display: { xs: 'none', md: 'block' },
            overflowY: 'auto',
            borderRight: `1px solid ${palette.line}`,
            bgcolor: '#FFFFFF',
            py: 2,
          }}
        >
          {sections.map((section) => {
            const { answered, total } = progressOf(section, answers);
            const done = total > 0 && answered === total;
            const here = active === section.id;
            return (
              <Box
                key={section.id}
                onClick={() => jumpTo(section.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 2.5,
                  py: 1.15,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${here ? palette.accent : 'transparent'}`,
                  bgcolor: here ? palette.accentWash : 'transparent',
                  transition: 'background-color 120ms ease, border-color 120ms ease',
                  '&:hover': { bgcolor: here ? palette.accentWash : 'rgba(17,17,17,0.04)' },
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    bgcolor: done ? palette.accent : 'transparent',
                    color: done ? palette.ink : palette.muted,
                    border: done ? 'none' : `1.5px solid ${palette.line}`,
                  }}
                >
                  {done ? <CheckOutlined sx={{ fontSize: 14 }} /> : section.number}
                </Box>
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: here ? 700 : 500,
                    color: here ? palette.ink : 'rgba(17,17,17,0.72)',
                    lineHeight: 1.25,
                  }}
                >
                  {section.title}
                </Typography>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: palette.muted }}>
                  {answered}/{total}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* ── Questions ── */}
        <Box ref={scroller} sx={{ overflowY: 'auto', scrollBehavior: 'smooth' }}>
          <Box
            className="smd-questionnaire"
            sx={{ maxWidth: 860, mx: 'auto', px: { xs: 2, md: 5 }, py: { xs: 3, md: 4 } }}
          >
            {/*
              Three states, and the difference matters to whoever is sitting
              here: we are fetching it, we could not, or the clinic has not
              published one. An empty form in any of those cases looks like a
              questionnaire with no questions, and somebody would submit it.
            */}
            {questionnaire === null && !loadFailed && (
              <Typography sx={{ color: palette.muted, py: 4, textAlign: 'center' }}>
                Načítáme dotazník…
              </Typography>
            )}

            {questionnaire === null && loadFailed && (
              <Typography sx={{ color: palette.muted, py: 4, textAlign: 'center' }}>
                Dotazník se nepodařilo načíst. Zavřete prosím okno a zkuste to
                za chvíli znovu — vaše dosavadní odpovědi zůstávají uložené.
              </Typography>
            )}

            {questionnaire !== null && sections.length === 0 && (
              <Typography sx={{ color: palette.muted, py: 4, textAlign: 'center' }}>
                Ordinace zatím žádné otázky nenastavila.
              </Typography>
            )}

            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                answers={answers}
                onChange={set}
                palette={palette}
              />
            ))}

            {/* ── Prohlášení ── */}
            <Box
              sx={{
                mt: 2,
                p: { xs: 2, md: 3 },
                borderRadius: 4,
                border: `1px solid ${palette.line}`,
                bgcolor: '#FFFFFF',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, letterSpacing: 0.8, display: 'block', mb: 1.5 }}
              >
                PROHLÁŠENÍ
              </Typography>
              <Typography variant="body2" sx={{ color: palette.muted, mb: 2.5, lineHeight: 1.65 }}>
                {DECLARATION}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={answers.declaration === true}
                    onChange={(event) => set('declaration', event.target.checked)}
                  />
                }
                label={
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                    Přečetl/a jsem a souhlasím. Uvedené údaje jsou pravdivé a úplné.
                  </Typography>
                }
              />
              <Box sx={{ mt: 2, maxWidth: 320 }}>
                <TextField
                  fullWidth
                  label="V (místo)"
                  placeholder="Praha"
                  value={typeof answers.declaration_place === 'string' ? answers.declaration_place : ''}
                  onChange={(event) => set('declaration_place', event.target.value)}
                  helperText="Datum doplníme podle dne odeslání."
                />
              </Box>
            </Box>

            <Box sx={{ height: 24 }} />
          </Box>
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box
        className="smd-no-print"
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${palette.line}`,
          bgcolor: '#FFFFFF',
          px: { xs: 2, md: 4 },
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          /* Stacked on a phone. Side by side, the sentence was squeezed into a
             column three words wide beside the buttons and read as damage. */
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flex: { sm: 1 },
            minWidth: 0,
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <CloudDoneOutlined sx={{ fontSize: 17, color: palette.accentDark, flexShrink: 0 }} />
          <Typography variant="caption" sx={{ color: palette.muted }}>
            Ukládá se průběžně ve vašem prohlížeči a odešle se spolu s registrací.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' } }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<PrintOutlined />}
            onClick={() => window.print()}
            sx={{ borderRadius: 999, px: 2.5, py: 1, borderColor: palette.line, color: palette.ink, whiteSpace: 'nowrap' }}
          >
            Vytisknout
          </Button>
          <Button
            fullWidth
            variant="contained"
            disableElevation
            onClick={onClose}
            sx={{ borderRadius: 999, px: 3.5, py: 1, color: palette.ink }}
          >
            Hotovo
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

function SectionBlock({
  section,
  answers,
  onChange,
  palette,
}: {
  section: Section;
  answers: Answers;
  onChange: (id: string, value: Answer) => void;
  palette: Palette;
}) {
  const items = itemsFor(section, answers);
  const { answered, total } = progressOf(section, answers);

  /*
   * Two questions abreast when they are short ones.
   *
   * The twenty-three condition rows and the family table are the bulk of this
   * form, and one per line turns them into a scroll nobody finishes. A text box
   * with a follow-up under it stays full width, because two of those side by
   * side is where a form starts looking like a spreadsheet.
   */
  const twoUp = ['rodina', 'infekcni', 'kardio', 'dychani', 'neuro', 'metabolicke'].includes(section.id);

  return (
    <Box
      id={`smd-sec-${section.id}`}
      data-smd-section
      sx={{ mb: 4, scrollMarginTop: 16 }}
    >
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 4,
          bgcolor: '#FFFFFF',
          border: `1px solid ${palette.line}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: section.note ? 0.75 : 2.5 }}>
          <Box
            sx={{
              minWidth: 28,
              height: 28,
              px: 0.75,
              borderRadius: 1.5,
              bgcolor: palette.ink,
              color: palette.accent,
              display: 'grid',
              placeItems: 'center',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {section.number}
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 17, md: 19 }, letterSpacing: '-0.01em' }}>
            {section.title}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography
            className="smd-no-print"
            sx={{ fontSize: 12.5, fontWeight: 700, color: answered === total && total > 0 ? palette.accentDark : palette.muted }}
          >
            {answered}/{total}
          </Typography>
        </Box>

        {section.note !== undefined && (
          <Typography variant="body2" sx={{ color: palette.muted, mb: 2.5 }}>
            {section.note}
          </Typography>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: twoUp ? { xs: '1fr', sm: '1fr 1fr' } : '1fr',
          }}
        >
          {items.map((item) => (
            <Box
              key={item.field.id}
              sx={{
                /* A notice and a follow-up box always span, whatever the
                   section's default is: half a warning is not a warning. */
                gridColumn: twoUp && (item.field.kind === 'notice' || item.field.kind === 'longtext')
                  ? { sm: '1 / -1' }
                  : undefined,
              }}
            >
              <FieldBlock
                field={item.field}
                value={answers[item.field.id] ?? null}
                onChange={onChange}
                palette={palette}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function FieldBlock({
  field,
  value,
  onChange,
  palette,
}: {
  field: Field;
  value: Answer;
  onChange: (id: string, value: Answer) => void;
  palette: Palette;
}) {
  switch (field.kind) {
    case 'notice':
      return (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 2.5,
            bgcolor: palette.accentWash,
            border: `1px solid ${palette.accentEdge}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {field.text}
          </Typography>
        </Box>
      );

    case 'yesno':
      /*
       * Ano / ne as two buttons, not two small radios.
       *
       * Neither is preselected: a preselected "ne" on a question about chest
       * pain under exertion is an answer nobody gave, recorded as though they
       * had. The row only takes colour once it has been answered, so what is
       * left blank is visible at a glance from across the section.
       */
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            minHeight: 60,
            px: 2,
            py: 1.25,
            borderRadius: 2.5,
            border: `1px solid ${value === null ? palette.line : palette.accentEdge}`,
            bgcolor: value === null ? 'transparent' : palette.accentWash,
            transition: 'background-color 120ms ease, border-color 120ms ease',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.35 }}>
              {field.label}
            </Typography>
            {field.help !== undefined && (
              <Typography variant="caption" sx={{ color: palette.muted }}>
                {field.help}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {([['ano', true], ['ne', false]] as const).map(([label, answer]) => {
              const chosen = value === answer;
              return (
                <Box
                  key={label}
                  component="button"
                  type="button"
                  onClick={() => onChange(field.id, chosen ? null : answer)}
                  sx={{
                    minWidth: 54,
                    py: 0.85,
                    px: 1.5,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    fontWeight: 700,
                    bgcolor: chosen ? palette.ink : '#FFFFFF',
                    color: chosen ? palette.accent : palette.muted,
                    border: `1px solid ${chosen ? palette.ink : palette.line}`,
                    transition: 'background-color 120ms ease, color 120ms ease',
                    '&:hover': { borderColor: chosen ? palette.ink : 'rgba(17,17,17,0.35)' },
                  }}
                >
                  {label}
                </Box>
              );
            })}
          </Box>
        </Box>
      );

    case 'relatives':
      /*
       * Which relatives this condition applies to. Several, or none — and none
       * is a real answer, which is why nothing here is ever required.
       */
      return (
        <Box
          sx={{
            minHeight: 60,
            px: 2,
            py: 1.25,
            borderRadius: 2.5,
            border: `1px solid ${Array.isArray(value) && value.length > 0 ? palette.accentEdge : palette.line}`,
            bgcolor: Array.isArray(value) && value.length > 0 ? palette.accentWash : 'transparent',
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: 14.5, mb: 0.75 }}>
            {field.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {RELATIVES.map((relative) => {
              const chosen = Array.isArray(value) && value.includes(relative);
              return (
                <Box
                  key={relative}
                  component="button"
                  type="button"
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      field.id,
                      chosen ? current.filter((r) => r !== relative) : [...current, relative],
                    );
                  }}
                  sx={{
                    py: 0.7,
                    px: 1.5,
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    bgcolor: chosen ? palette.ink : '#FFFFFF',
                    color: chosen ? palette.accent : palette.muted,
                    border: `1px solid ${chosen ? palette.ink : palette.line}`,
                    transition: 'background-color 120ms ease, color 120ms ease',
                  }}
                >
                  {relative}
                </Box>
              );
            })}
          </Box>
        </Box>
      );

    case 'choice':
      return (
        <TextField
          select
          fullWidth
          label={field.label}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(field.id, event.target.value)}
        >
          {field.options.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      );

    case 'number':
      return (
        <TextField
          fullWidth
          type="number"
          label={field.label}
          helperText={field.help}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(field.id, event.target.value)}
          slotProps={{ htmlInput: { min: field.min, max: field.max } }}
        />
      );

    case 'longtext':
      return (
        <TextField
          fullWidth
          multiline
          minRows={2}
          label={field.label}
          helperText={field.help}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(field.id, event.target.value)}
        />
      );

    case 'text':
    default:
      return (
        <TextField
          fullWidth
          label={field.label}
          placeholder={'placeholder' in field ? field.placeholder : undefined}
          helperText={field.help}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(field.id, event.target.value)}
        />
      );
  }
}
