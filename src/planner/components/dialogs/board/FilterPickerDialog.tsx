/*
 * `filterPicker` - prototype `openFilterPicker()`: "Filtrovat činnosti", one select and "Použít filtr".
 */
import { useState } from 'react';
import { usePlannerActions, usePlannerSelector } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';

function FilterPickerForm({ close }: { close: () => void }) {
  const ctx = usePlannerCtx();
  const act = usePlannerActions();
  const filter = usePlannerSelector((s) => s.filter);
  const [value, setValue] = useState<string>(filter);
  return (
    <>
      <div className="field full">
        <label htmlFor="dialog-filter">Zobrazit činnosti</label>
        <select id="dialog-filter" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="all">Všechny činnosti</option>
          {ctx.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
        <button className="app-button" type="button" data-close="1" onClick={close}>Zrušit</button>
        <button
          className="app-button primary"
          id="apply-filter"
          type="button"
          onClick={() => {
            act.setFilter(value);
            close();
          }}
        >
          Použít filtr
        </button>
      </div>
    </>
  );
}

export const filterPickerDialog: DialogRenderer<'filterPicker'> = ({ close }) => ({
  body: <FilterPickerForm close={close} />,
  footer: <></>,
});
