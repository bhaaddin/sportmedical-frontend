/* Loads the anatomy of a clip (json + binary from the API or the fixtures, the bone meshes from the static asset) and builds the engine. */
import { useEffect, useState } from 'react';
import { getAnatomyBin, getAnatomyJson } from '../../api/movement';
import { parseAnatomy } from './anatomyData';
import glbUrl from '../assets/myofullbody.glb?url';
import type { AnatomyEngine } from './engine';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

let glbCache: Promise<ArrayBuffer> | null = null;
/** The bone meshes are one static file: fetched once per session. */
const loadMeshes = (): Promise<ArrayBuffer> => (glbCache ??= fetch(glbUrl).then((r) => {
  if (!r.ok) throw new Error('bone meshes');
  return r.arrayBuffer();
}).catch((e) => { glbCache = null; throw e; }));

/** The engine of a clip once everything is loaded; `available` is `result.anatomy.available`. Everything heavy is a lazy chunk. */
export function useAnatomyEngine(clipId: string, available: boolean): { engine: AnatomyEngine | null; status: EngineStatus } {
  const [state, setState] = useState<{ engine: AnatomyEngine | null; status: EngineStatus }>({ engine: null, status: available ? 'loading' : 'idle' });
  useEffect(() => {
    if (!available) { setState({ engine: null, status: 'idle' }); return undefined; }
    let live = true;
    let built: AnatomyEngine | null = null;
    setState({ engine: null, status: 'loading' });
    (async () => {
      const [json, bin, glb] = await Promise.all([getAnatomyJson(clipId), getAnatomyBin(clipId), loadMeshes()]);
      const anatomy = parseAnatomy(json, bin);
      const { AnatomyEngine: Engine } = await import('./engine');
      const engine = await Engine.create(anatomy, glb);
      if (!live) { engine.dispose(); return; }
      built = engine;
      setState({ engine, status: 'ready' });
    })().catch(() => { if (live) setState({ engine: null, status: 'failed' }); });
    return () => { live = false; built?.dispose(); };
  }, [clipId, available]);
  return state;
}
