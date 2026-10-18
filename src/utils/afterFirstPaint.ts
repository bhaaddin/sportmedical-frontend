/*
 * Waits for the first paint to be behind us: after `load`, then an idle moment of the browser (at most
 * `maxWaitMs` later). What is not needed to draw the first screen - the live connection, the strip that says
 * "the server is not answering" with its animation library, the next screens' scripts - starts from here, so it
 * never competes with the first screen for the network or the main thread.
 */
export function afterFirstPaint(maxWaitMs: number = 2_000): Promise<void> {
  return new Promise((resolve) => {
    const idle = () => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback;
      if (typeof ric === 'function') ric(() => resolve(), { timeout: maxWaitMs });
      else setTimeout(resolve, 200);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });
}
