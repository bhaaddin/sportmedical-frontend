import { useEffect, useRef } from 'react';
import { SHORTCUT_LIST } from '../../../components/booking/extras/shortcutMap';

/** R15c (e): "?" lists the shortcuts in a small pop-out over the board. Esc, the button or a click outside closes it; focus returns to the board. */
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="board-shortcuts" role="dialog" aria-label="Klávesové zkratky" tabIndex={-1} data-testid="board-shortcuts">
      <div className="board-shortcuts-head">
        <strong>Klávesové zkratky</strong>
        <button type="button" className="control" aria-label="Zavřít" data-testid="board-shortcuts-close" onClick={onClose}>×</button>
      </div>
      <dl>
        {SHORTCUT_LIST.map((s) => (
          <div key={s.keys}>
            <dt>{s.keys}</dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>
      <small>Zkratky nefungují při psaní do políček.</small>
    </div>
  );
}

export default ShortcutsHelp;
