/*
 * `filterPicker` - prototype `openFilterPicker()`: "Filtrovat činnosti", one select and "Použít filtr".
 */
import { useState } from 'react';
import { usePlannerActions, usePlannerSelector } from '../../../state/PlannerStoreProvider';
import { usePlannerCtx } from '../../context';
import { categoryWithPrice, serviceWithPrice } from '../../categoryPrice';
import { normalizeFilter, plannerServices } from '../../../model/services';
import { usePlannerModelState } from '../../context';
import type { DialogRenderer } from '../../dialogRegistry';

function FilterPickerForm({ close }: { close: () => void }) {
  const ctx = usePlannerCtx();
  const act = usePlannerActions();
  const filter = usePlannerSelector((s) => s.filter);
  const { catalogue } = usePlannerModelState();
  /* the main planner filters by služba (R1); a club's own board keeps the činnosti of its order */
  const byService = !(catalogue?.capabilities.mode ? catalogue.capabilities.mode === 'club' : ctx.demands.length > 0);
  const [value, setValue] = useState<string>(byService ? normalizeFilter(filter, ctx.categories) : filter);
  return (
    <>
      <div className="field full">
        <label htmlFor="dialog-filter">{byService ? 'Zobrazit služby' : 'Zobrazit činnosti'}</label>
        {byService ? (
          <select id="dialog-filter" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="all">Všechny služby</option>
            {plannerServices(ctx.categories).map((s) => <option key={s.id} value={s.id} title={serviceWithPrice(s)}>{serviceWithPrice(s)}</option>)}
          </select>
        ) : (
          <select id="dialog-filter" value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="all">Všechny činnosti</option>
            {ctx.categories.map((c) => <option key={c.id} value={c.id} title={categoryWithPrice(c)}>{categoryWithPrice(c)}</option>)}
          </select>
        )}
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
