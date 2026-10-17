/*
 * `search` - "Vyhledat termín" (prototype `searchDialog()`): a term by činnost, date or time among
 * the terms of the board; a hit opens the term. The people, invoices and settings of the whole
 * system are searched by the application's own palette (Ctrl+K), which the footer button opens -
 * this dialog does not build a second search of them.
 */
import { useState } from 'react';
import { openUniversalSearch } from '../../../../components/UniversalSearch';
import { searchTerms, sourceFor } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';

function SearchBody() {
  const ctx = usePlannerCtx();
  const act = usePlannerActions();
  const [needle, setNeedle] = useState('');
  const found = searchTerms(ctx, needle);

  const open = (id: string) => {
    const term = ctx.sessions.find((s) => s.id === id);
    act.openDialog(term && sourceFor(term) === 'club' ? { kind: 'agendaDetail', id } : { kind: 'eventDetail', id });
  };

  return (
    <>
      <input
        className="global-search"
        id="search-input"
        data-autofocus="1"
        type="search"
        placeholder="Např. prohlídka, 18. 11., fyzioterapie…"
        autoComplete="off"
        aria-label="Hledat termín podle činnosti, data nebo času"
        value={needle}
        onChange={(event) => setNeedle(event.target.value)}
      />
      <div id="search-results" aria-live="polite">
        {found.length ? (
          found.map((r) => (
            <button type="button" className="search-result" key={r.id} data-event={r.id} onClick={() => open(r.id)}>
              <span>{r.label}</span>
              <span className="result-aux">{r.aux}</span>
            </button>
          ))
        ) : (
          <div className="empty-info">Nenašli se žádné termíny.</div>
        )}
      </div>
    </>
  );
}

export const searchDialog: DialogRenderer<'search'> = ({ close }) => ({
  body: <SearchBody />,
  footer: (
    <>
      <button type="button" className="app-button" onClick={() => { close(); openUniversalSearch(); }} title="Pacienti, faktury, termíny a nastavení (Ctrl+K)">
        Hledat v celém systému
      </button>
      <button type="button" className="app-button" data-close="1" onClick={close}>Zavřít</button>
    </>
  ),
});
