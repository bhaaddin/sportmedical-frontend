/*
 * OpenCV lives here, on its own thread, and never on the one that draws.
 *
 * The reason is measured, not theoretical. `@techstark/opencv-js` ships
 * `opencv.js` at 10.8 MB - JavaScript, not a separate `.wasm` file the browser
 * can compile in the background. Importing it on the main thread means the
 * browser parses and compiles eleven megabytes of code before it can paint
 * anything again: clicking "Naskenovat" froze the whole application, and the
 * page stopped answering for the best part of a minute. It was not the dev
 * server - the same bytes are in the production build.
 *
 * A worker fixes both halves of that. The load happens off the drawing thread,
 * so the dialog stays alive and can say what it is doing; and detection, which
 * then runs several times a second on live camera frames, never competes with
 * the preview it is drawing an outline on.
 *
 * Frames come in as `ImageData` and results go back the same way. The buffers
 * are transferred rather than copied - a 1080p frame is eight megabytes, and
 * copying that at six frames a second would give back the stutter the worker
 * was for.
 */
import { detectDocument, flatten, applyFilter, type ScanFilter } from './detect';
import type { Quad } from './geometry';
import type { Cv } from './cvTypes';

type Request =
  | { id: number; kind: 'warmup' }
  | { id: number; kind: 'detect'; image: ImageData }
  | { id: number; kind: 'flatten'; image: ImageData; quad: Quad; filter: ScanFilter };

type Response =
  | { id: number; ok: true; kind: 'warmup' }
  | { id: number; ok: true; kind: 'detect'; quad: Quad | null }
  | { id: number; ok: true; kind: 'flatten'; image: ImageData }
  | { id: number; ok: false; error: string };

let cvPromise: Promise<Cv> | null = null;

/**
 * Load OpenCV once, and wait for its runtime rather than merely its module.
 *
 * The module resolves before the runtime is ready; calling in too early throws
 * from inside Emscripten with a message nobody can act on.
 */
function getCv(): Promise<Cv> {
  if (cvPromise !== null) return cvPromise;

  cvPromise = import('@techstark/opencv-js').then(
    (module) =>
      new Promise<Cv>((resolve, reject) => {
        const cv = (module.default ?? module) as Cv & {
          onRuntimeInitialized?: () => void;
          Mat?: unknown;
        };

        if (typeof cv.Mat === 'function') {
          resolve(cv);
          return;
        }

        const timeout = setTimeout(
          () => reject(new Error('OpenCV se nepodařilo načíst včas.')),
          60_000,
        );
        cv.onRuntimeInitialized = () => {
          clearTimeout(timeout);
          resolve(cv);
        };
      }),
  );

  /* A failed load must not poison later attempts - somebody on a slow
     connection should be able to try again without reloading the page. */
  cvPromise.catch(() => {
    cvPromise = null;
  });

  return cvPromise;
}

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  const post = (response: Response, transfer: Transferable[] = []) =>
    (self as unknown as Worker).postMessage(response, transfer);

  try {
    const cv = await getCv();

    switch (request.kind) {
      case 'warmup':
        post({ id: request.id, ok: true, kind: 'warmup' });
        return;

      case 'detect': {
        const quad = detectDocument(cv, request.image);
        post({ id: request.id, ok: true, kind: 'detect', quad });
        return;
      }

      case 'flatten': {
        const flattened = flatten(cv, request.image, request.quad);
        const finished = applyFilter(cv, flattened, request.filter);
        post({ id: request.id, ok: true, kind: 'flatten', image: finished }, [
          finished.data.buffer,
        ]);
        return;
      }
    }
  } catch (caught) {
    post({
      id: request.id,
      ok: false,
      error: caught instanceof Error ? caught.message : 'Sken selhal.',
    });
  }
};

export type { Request as ScannerRequest, Response as ScannerResponse };
