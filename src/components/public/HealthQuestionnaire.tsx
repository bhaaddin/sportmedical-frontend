/* ══════════════════════════════════════════════════════════════
   ZDRAVOTNÍ DOTAZNÍK — the form itself

   Renders `healthQuestionnaire.ts` on the public registration page. Read that
   file's header first: the questions are defined in the browser, which is the
   wrong place, and why they are there anyway.

   ── Where the answers go ──

   Nowhere, yet. `PublicIntakeSubmission` carries identity, contact, address,
   insurance and consents, and there is no field for 76 medical answers. Lane
   app has the brief.

   A form that looks like it saves and does not is worse than no form, so this
   one does not pretend: answers are kept in the browser as you type, the page
   says plainly that they are not sent yet, and the button at the bottom prints
   the filled-in form — which is exactly what the clinic asks for today
   ("Vyplněný dokument si prosím přineste s sebou"). On paper this replaces a
   PDF that has to be printed blank and filled in by hand, so it is already
   better than the thing it stands in for, and it stops being a stopgap the day
   there is an endpoint.

   ── The browser copy ──

   `localStorage`, wrapped, and treated as a convenience that may simply not be
   there: a private window, blocked site data, or a thrown SecurityError all end
   with an empty form rather than a broken one. It is per-browser and per-device
   and reaches nobody else — which is fine for a draft somebody is in the middle
   of, and is not a place medical answers live.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { PrintOutlined } from '@mui/icons-material';
import {
  DECLARATION,
  RELATIVES,
  itemsFor,
  progressOf,
  sectionsFor,
} from '../../services/publicIntake/healthQuestionnaire';
import type { Answer, Answers, Field, Section } from '../../services/publicIntake/healthQuestionnaire';

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

interface Palette {
  ink: string;
  accent: string;
  accentDark: string;
  accentWash: string;
  accentEdge: string;
  line: string;
  muted: string;
}

export default function HealthQuestionnaire({
  female,
  palette,
}: {
  female: boolean;
  palette: Palette;
}) {
  const [answers, setAnswers] = useState<Answers>(load);

  useEffect(() => { save(answers); }, [answers]);

  const sections = useMemo(() => sectionsFor(female), [female]);

  const set = (id: string, value: Answer): void =>
    setAnswers((previous) => ({ ...previous, [id]: value }));

  const totals = sections.reduce(
    (running, section) => {
      const { answered, total } = progressOf(section, answers);
      return { answered: running.answered + answered, total: running.total + total };
    },
    { answered: 0, total: 0 },
  );

  const percent = totals.total === 0 ? 0 : Math.round((totals.answered / totals.total) * 100);

  return (
    <Box className="smd-questionnaire">
      {/*
        A count, not a step. It exists because this form is long and somebody
        who cannot see the end of it gives up — the same reason the wizard was
        removed from the page around it. It never blocks anything: every
        question here is optional today.
      */}
      <Box sx={{ mb: 3 }} className="smd-no-print">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: palette.muted }}>
            Vyplněno {totals.answered} z {totals.total}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 800, color: palette.accentDark }}>
            {percent} %
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percent}
          sx={{
            height: 6,
            borderRadius: 999,
            bgcolor: palette.line,
            '& .MuiLinearProgress-bar': { bgcolor: palette.accent, borderRadius: 999 },
          }}
        />
      </Box>

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
          mt: 4,
          p: 2,
          borderRadius: 3,
          border: `1px solid ${palette.line}`,
          bgcolor: 'rgba(17,17,17,0.03)',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.6, display: 'block', mb: 1 }}>
          PROHLÁŠENÍ
        </Typography>
        <Typography variant="body2" sx={{ color: palette.muted, mb: 2 }}>
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
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Přečetl/a jsem a souhlasím. Uvedené údaje jsou pravdivé a úplné.
            </Typography>
          }
        />
        <Box sx={{ mt: 1.5, maxWidth: 280 }}>
          <TextField
            fullWidth
            size="small"
            label="V (místo)"
            placeholder="Praha"
            value={typeof answers.declaration_place === 'string' ? answers.declaration_place : ''}
            onChange={(event) => set('declaration_place', event.target.value)}
            helperText="Datum doplníme podle dne odeslání."
          />
        </Box>
      </Box>

      {/*
        Print, because that is the clinic's current flow: fill it in at home and
        bring it. The stylesheet in the page hides everything except this block,
        so what comes out is the questionnaire and not the registration form
        around it.
      */}
      <Button
        className="smd-no-print"
        fullWidth
        variant="outlined"
        startIcon={<PrintOutlined />}
        onClick={() => window.print()}
        sx={{ mt: 3, borderRadius: 999, py: 1.25, borderColor: palette.line, color: palette.ink }}
      >
        Vytisknout vyplněný dotazník
      </Button>

      <Typography
        className="smd-no-print"
        variant="caption"
        sx={{ color: palette.muted, display: 'block', mt: 1.5, textAlign: 'center' }}
      >
        Odpovědi zůstávají ve vašem prohlížeči — zatím se nikam neodesílají.
        Vytiskněte je prosím a přineste s sebou.
      </Typography>
    </Box>
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

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
        <Box
          sx={{
            minWidth: 24,
            height: 24,
            px: 0.5,
            borderRadius: 1.25,
            bgcolor: palette.ink,
            color: palette.accent,
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {section.number}
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 15.5 }}>{section.title}</Typography>
        {total > 0 && (
          <Chip
            className="smd-no-print"
            size="small"
            label={`${answered}/${total}`}
            sx={{
              height: 18,
              fontSize: 11,
              fontWeight: 700,
              bgcolor: answered === total ? palette.accentWash : 'transparent',
              border: `1px solid ${answered === total ? palette.accentEdge : palette.line}`,
            }}
          />
        )}
      </Box>

      {section.note !== undefined && (
        <Typography variant="body2" sx={{ color: palette.muted, mb: 1.5 }}>
          {section.note}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {items.map((item) => (
          <FieldBlock
            key={item.field.id}
            field={item.field}
            value={answers[item.field.id] ?? null}
            onChange={onChange}
            palette={palette}
          />
        ))}
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
            px: 1.75,
            py: 1.25,
            borderRadius: 2,
            bgcolor: palette.accentWash,
            border: `1px solid ${palette.accentEdge}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {field.text}
          </Typography>
        </Box>
      );

    case 'yesno':
      /*
       * Ano / ne with no default.
       *
       * Neither is preselected, because a preselected "ne" is an answer nobody
       * gave — and on a form about heart symptoms, an ungiven "ne" is the worst
       * possible thing to record.
       */
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            px: 1.75,
            py: 1.25,
            borderRadius: 2,
            border: `1px solid ${value === null ? palette.line : palette.accentEdge}`,
            bgcolor: value === null ? 'transparent' : palette.accentWash,
          }}
        >
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {field.label}
            </Typography>
            {field.help !== undefined && (
              <Typography variant="caption" sx={{ color: palette.muted }}>
                {field.help}
              </Typography>
            )}
          </Box>
          <RadioGroup
            row
            value={value === null ? '' : value === true ? 'ano' : 'ne'}
            onChange={(event) => onChange(field.id, event.target.value === 'ano')}
            sx={{ flexShrink: 0 }}
          >
            <FormControlLabel value="ano" control={<Radio size="small" />} label="ano" />
            <FormControlLabel value="ne" control={<Radio size="small" />} label="ne" />
          </RadioGroup>
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
            px: 1.75,
            py: 1,
            borderRadius: 2,
            border: `1px solid ${palette.line}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {field.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
            {RELATIVES.map((relative) => {
              const chosen = Array.isArray(value) && value.includes(relative);
              return (
                <Chip
                  key={relative}
                  size="small"
                  label={relative}
                  onClick={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      field.id,
                      chosen ? current.filter((r) => r !== relative) : [...current, relative],
                    );
                  }}
                  sx={{
                    fontWeight: 700,
                    cursor: 'pointer',
                    bgcolor: chosen ? palette.ink : 'transparent',
                    color: chosen ? palette.accent : palette.muted,
                    border: `1px solid ${chosen ? palette.ink : palette.line}`,
                    '&:hover': { bgcolor: chosen ? palette.ink : palette.accentWash },
                  }}
                />
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
          size="small"
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
          size="small"
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
          size="small"
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
          size="small"
          label={field.label}
          placeholder={'placeholder' in field ? field.placeholder : undefined}
          helperText={field.help}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(field.id, event.target.value)}
        />
      );
  }
}
