/*
 * The main thread's side of the scanner worker.
 *
 * Turns `postMessage` into promises, and - the part that matters for a live
 * preview - refuses to queue work. A camera frame that has not been looked at
 * by the time the next one arrives is worthless: the page has moved. So
 * `detect` returns null immediately while the worker is busy, and the preview
 * simply skips that frame rather than building a backlog of stale ones that
 * make the outline lag further behind the page with every second.
 */
import type { Quad } from './geometry';
import type { ScanFilter } from './detect';
import type { ScannerRequest, ScannerResponse } from './scannerWorker';

type Pending = {
  resolve: (value: ScannerResponse) => void;
  reject: (reason: Error) => void;
};

export class ScannerClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private busy = false;

  private ensureWorker(): Worker {
    if (this.worker !== null) return this.worker;

    const worker = new Worker(new URL('./scannerWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<ScannerResponse>) => {
      const entry = this.pending.get(event.data.id);
      if (entry === undefined) return;
      this.pending.delete(event.data.id);
      entry.resolve(event.data);
    };

    /* A worker that dies takes every outstanding request with it. Rejecting
       them is what lets the dialog say so instead of spinning for ever. */
    worker.onerror = () => {
      for (const [, entry] of this.pending) {
        entry.reject(new Error('Sken se nečekaně ukončil.'));
      }
      this.pending.clear();
      this.busy = false;
    };

    this.worker = worker;
    return worker;
  }

  private send(request: ScannerRequest, transfer: Transferable[] = []): Promise<ScannerResponse> {
    const worker = this.ensureWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      worker.postMessage(request, transfer);
    });
  }

  /**
   * Load OpenCV without asking it to do anything yet.
   *
   * Called when the dialog opens, so the eleven megabytes are on their way
   * while the camera permission prompt is still on screen - the two slowest
   * things happen at once rather than one after the other.
   */
  async warmup(): Promise<void> {
    const id = this.nextId++;
    const response = await this.send({ id, kind: 'warmup' });
    if (!response.ok) throw new Error(response.error);
  }

  /**
   * The page in this frame, or null.
   *
   * Null also means "the worker was busy" - indistinguishable to the caller on
   * purpose, because both mean the same thing for a preview: draw nothing this
   * time round and try again with the next frame.
   */
  async detect(image: ImageData): Promise<Quad | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      const id = this.nextId++;
      const response = await this.send({ id, kind: 'detect', image }, [image.data.buffer]);
      if (!response.ok || response.kind !== 'detect') return null;
      return response.quad;
    } catch {
      return null;
    } finally {
      this.busy = false;
    }
  }

  /** Flatten the page and apply the chosen look. Throws, because this one is
      a deliberate action and silence would leave somebody waiting. */
  async flatten(image: ImageData, quad: Quad, filter: ScanFilter): Promise<ImageData> {
    const id = this.nextId++;
    const response = await this.send({ id, kind: 'flatten', image, quad, filter }, [
      image.data.buffer,
    ]);
    if (!response.ok) throw new Error(response.error);
    if (response.kind !== 'flatten') throw new Error('Sken vrátil neočekávanou odpověď.');
    return response.image;
  }

  /** Free the worker - and the eleven megabytes it is holding. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
    this.busy = false;
  }
}
