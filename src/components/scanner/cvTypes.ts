/*
 * OpenCV's types, and nothing else.
 *
 * `import type` is erased at build time, so naming this module costs nothing
 * at runtime - which is the whole point. The only place that imports OpenCV
 * for real is `scannerWorker.ts`, on its own thread. If a value import of
 * `@techstark/opencv-js` ever appears outside that file, eleven megabytes go
 * back onto the thread that draws the screen and the application freezes when
 * somebody presses "Naskenovat". It did, once; that is why this file exists
 * instead of a convenient shared loader.
 */
import type * as OpenCvTypes from '@techstark/opencv-js';

export type Cv = typeof OpenCvTypes;
