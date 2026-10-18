/*
 * The in-memory demo source (`DemoDataSource`: fixtures for the lab, `?source=demo` and the tests) is loaded when
 * somebody actually asks for it. `/planovani` and `/clubs/:id` run on the clinic's own data and must not carry the demo
 * code in the script they download; only the lab and `?source=demo` fetch it, here.
 *
 * Returns null while the demo is off or still loading, so the caller shows its own waiting state.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DemoDataSource, DemoDataSourceOptions } from './DemoDataSource';

export function useDemoDataSource(enabled: boolean, options: DemoDataSourceOptions): DemoDataSource | null {
  const [ctor, setCtor] = useState<typeof DemoDataSource | null>(null);

  useEffect(() => {
    if (!enabled || ctor !== null) return undefined;
    let live = true;
    void import('./DemoDataSource').then((m) => {
      if (live) setCtor(() => m.DemoDataSource);
    });
    return () => {
      live = false;
    };
  }, [enabled, ctor]);

  const { today, latencyMs } = options;
  return useMemo(
    () => (enabled && ctor !== null ? new ctor({ ...(today !== undefined ? { today } : {}), ...(latencyMs !== undefined ? { latencyMs } : {}) }) : null),
    [enabled, ctor, today, latencyMs],
  );
}
