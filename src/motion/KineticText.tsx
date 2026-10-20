/* ══════════════════════════════════════════════════════════════
   KINETIC TEXT - a headline whose words rise out of a mask, one after another.

   It is CSS, not script: the words are plain spans in the prerendered HTML, `html[data-motion="full"]` (set before
   the first paint) starts the keyframes (src/motion/motion.css), so the intro plays while the page is still loading
   its JavaScript, and a reader without script, with 'omezené' or with 'vypnuto' sees the words in place.
   ══════════════════════════════════════════════════════════════ */

import { Fragment } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface KineticLinesProps {
  /** The text; "\n" starts a new line. */
  text: string;
  /** Draw the last line in `accent` (only when there is more than one line, like the plain `Lines`). */
  accentLast?: boolean;
  accent?: string;
  /** Seconds before the first word. */
  delay?: number;
}

export function KineticLines({ text, accentLast = false, accent, delay = 0.18 }: KineticLinesProps): ReactNode {
  const lines = text.split('\n');
  let index = 0;
  return lines.map((line, lineIndex) => {
    const isAccent = accentLast && lineIndex === lines.length - 1 && lines.length > 1;
    const words = line.split(' ').filter((word) => word !== '');
    const content = words.map((word, wordIndex) => {
      const style = { '--i': index, '--d': `${delay}s` } as CSSProperties;
      index += 1;
      return (
        <Fragment key={`${word}-${wordIndex}`}>
          {wordIndex > 0 && ' '}
          <span className="sm-kt-w">
            <span className="sm-kt-i" style={style}>{word}</span>
          </span>
        </Fragment>
      );
    });
    return (
      <Fragment key={lineIndex}>
        {lineIndex > 0 && <br />}
        {isAccent ? <span style={{ color: accent }}>{content}</span> : content}
      </Fragment>
    );
  });
}

/** The words of a text as plain spans (.sm-lw): a scroll scene lights them up one after another while the text is read. */
export function LightWords({ text }: { text: string }): ReactNode {
  return text.split('\n').map((line, lineIndex) => (
    <Fragment key={lineIndex}>
      {lineIndex > 0 && <br />}
      {line
        .split(' ')
        .filter((word) => word !== '')
        .map((word, wordIndex) => (
          <Fragment key={wordIndex}>
            {wordIndex > 0 && ' '}
            <span className="sm-lw">{word}</span>
          </Fragment>
        ))}
    </Fragment>
  ));
}
