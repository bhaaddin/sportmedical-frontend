/*
 * CompactHeader - the club / clinic header in the tablet / phone layouts: one row (logo, name, the bell and the
 * profile chip) with an expander for the three data columns (identification, leadership, contact person).
 * `ClubHeader` is rendered untouched; the collapsed state hides `#club-details-strip` with CSS, so every `#hdr-*`
 * element stays in the DOM and the expander only toggles `data-open` on the wrapper.
 */
import { useState, type ReactNode } from 'react';
import { Icon } from '../Icons';

export function CompactHeader({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="compact-header" data-open={open ? 'true' : 'false'} data-testid="compact-header">
      {children}
      <button
        type="button"
        className="compact-header-toggle"
        aria-expanded={open}
        aria-controls="club-details-strip"
        data-testid="compact-header-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? 'Skrýt údaje' : 'Údaje'}</span>
        <Icon name="chevron-down" />
      </button>
    </div>
  );
}
