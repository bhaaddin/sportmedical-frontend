/*
 * R23 - the small pop-out at the click: "Hned po předchozím (10:30)" or "Přesně jak jsem klikl (10:40)".
 * Lazy (the planner's first load does not carry it). Two buttons, 44 px, the first one focused, Esc / click away closes it and books
 * nothing, and it honours the motion setting (no fade when "Animace" is off or reduced).
 */
import { Popover } from '@mui/material';
import { GAP_TEXT, withHHMM, type GapQuestion } from '../../model/gaps';
import { DESIGN } from '../../../theme';
import { useMotionPreference } from '../../../motion/useMotionPreference';

export interface GapChoiceProps {
  question: GapQuestion | null;
  /** Where the click was (client px). */
  x: number;
  y: number;
  onChoose: (range: { start: number; end: number }) => void;
  onClose: () => void;
}

export function GapChoice({ question, x, y, onChoose, onClose }: GapChoiceProps) {
  const motion = useMotionPreference();
  if (!question) return null;
  const lead = question.kind === 'lead';
  const movedText = lead ? GAP_TEXT.lead(withHHMM(question.moved.start)) : GAP_TEXT.tail(withHHMM(question.moved.end));
  const keepText = lead ? GAP_TEXT.asClicked(withHHMM(question.asClicked.start)) : GAP_TEXT.keep;
  const title = lead ? GAP_TEXT.leadTitle(question.gap) : GAP_TEXT.tailTitle(question.gap);
  return (
    <Popover
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: y, left: x }}
      transitionDuration={motion.reduced ? 0 : undefined}
      slotProps={{ paper: { sx: { width: 300, maxWidth: 'calc(100vw - 24px)', p: 1.5, borderRadius: '10px', boxShadow: DESIGN.shadow.menu } } }}
    >
      <div role="group" aria-label={title} data-testid="gap-choice" data-kind={question.kind} className="gap-choice">
        <strong>{title}</strong>
        <p>{lead ? GAP_TEXT.leadHint : GAP_TEXT.tailHint}</p>
        <div className="gap-choice-actions">
          <button type="button" className="gap-choice-btn is-primary" autoFocus data-testid="gap-moved" onClick={() => onChoose(question.moved)}>
            {movedText}
          </button>
          <button type="button" className="gap-choice-btn" data-testid="gap-keep" onClick={() => onChoose(question.asClicked)}>
            {keepText}
          </button>
        </div>
      </div>
    </Popover>
  );
}

export default GapChoice;
