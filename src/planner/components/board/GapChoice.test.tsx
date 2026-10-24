import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GapChoice } from './GapChoice';
import type { GapQuestion } from '../../model/gaps';

afterEach(cleanup);

const lead: GapQuestion = { kind: 'lead', gap: 10, moved: { start: 630, end: 660 }, asClicked: { start: 640, end: 670 } };
const tail: GapQuestion = { kind: 'tail', gap: 10, moved: { start: 590, end: 660 }, asClicked: { start: 580, end: 650 } };

describe('GapChoice (R23)', () => {
  it('offers "Hned po předchozím (10:30)" and "Přesně jak jsem klikl (10:40)", the first one focused', () => {
    render(<GapChoice question={lead} x={100} y={100} onChoose={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole('group', { name: 'Mezi termíny zůstane mezera 10 min' })).toBeInTheDocument();
    const moved = screen.getByTestId('gap-moved');
    const keep = screen.getByTestId('gap-keep');
    expect(moved).toHaveTextContent('Hned po předchozím (10:30)');
    expect(keep).toHaveTextContent('Přesně jak jsem klikl (10:40)');
    expect(moved).toHaveFocus();
  });

  it('each button hands back its own place', () => {
    const onChoose = vi.fn();
    render(<GapChoice question={lead} x={0} y={0} onChoose={onChoose} onClose={() => undefined} />);
    fireEvent.click(screen.getByTestId('gap-moved'));
    expect(onChoose).toHaveBeenLastCalledWith(lead.moved);
    fireEvent.click(screen.getByTestId('gap-keep'));
    expect(onChoose).toHaveBeenLastCalledWith(lead.asClicked);
  });

  it('Esc closes it and chooses nothing', () => {
    const onChoose = vi.fn();
    const onClose = vi.fn();
    render(<GapChoice question={lead} x={0} y={0} onChoose={onChoose} onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('gap-choice'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('the tail question reads "Posunout na konec (do 11:00)" / "Nechat"', () => {
    render(<GapChoice question={tail} x={0} y={0} onChoose={() => undefined} onClose={() => undefined} />);
    expect(screen.getByTestId('gap-moved')).toHaveTextContent('Posunout na konec (do 11:00)');
    expect(screen.getByTestId('gap-keep')).toHaveTextContent('Nechat');
  });

  it('draws nothing without a question', () => {
    render(<GapChoice question={null} x={0} y={0} onChoose={() => undefined} onClose={() => undefined} />);
    expect(screen.queryByTestId('gap-choice')).toBeNull();
  });
});
