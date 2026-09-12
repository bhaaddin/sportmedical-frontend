/*
 * Finding the page in a photograph, and flattening it.
 *
 * The pipeline is the one every document scanner uses, and each step is here
 * for a reason that shows up on a real desk:
 *
 *   downscale      detection runs on a small copy; a phone camera frame is
 *                  twelve megapixels and looking for edges in all of it, 15
 *                  times a second, empties the battery and drops the preview
 *   grey + blur    paper has texture and print; both make edges the page does
 *                  not have
 *   dilate         a page on a white desk has a seam, not a line - closing it
 *                  is the difference between one contour and four
 *   Canny          the edges themselves
 *   contours       largest first, because the page is the biggest thing held
 *                  up to a camera
 *   approx         a contour with 200 points becomes four, or it is not a page
 *
 * Everything here takes and returns `ImageData` rather than a canvas: it runs
 * inside a worker, where there is no DOM to read a canvas from. That is not a
 * detail - see `scannerWorker.ts` for why it has to.
 *
 * Everything OpenCV allocates is freed explicitly. Its objects live in
 * WebAssembly memory that the JavaScript garbage collector cannot see, so a
 * missed `delete` is a leak that grows with every preview frame - and this
 * runs on every preview frame.
 */
import type { Cv } from './cvTypes';
import {
  orderCorners,
  isPlausibleDocument,
  outputSize,
  type Point,
  type Quad,
} from './geometry';

/** Detection runs on a copy no larger than this on its long side. */
const DETECT_MAX_SIDE = 500;

/**
 * The page in this image, in the image's own coordinates, or null.
 *
 * Null means "not found", never "here is my best guess". A confident wrong
 * quad is worse than none: it gets accepted, and the výpis is filed with its
 * top third missing.
 */
export function detectDocument(cv: Cv, image: ImageData): Quad | null {
  const width = image.width;
  const height = image.height;
  if (width <= 0 || height <= 0) return null;

  const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(width, height));
  const src = cv.matFromImageData(image);
  const work = new cv.Mat();
  const grey = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  try {
    cv.resize(
      src,
      work,
      new cv.Size(Math.round(width * scale), Math.round(height * scale)),
      0,
      0,
      cv.INTER_AREA,
    );
    cv.cvtColor(work, grey, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(grey, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 60, 180);
    cv.dilate(edges, dilated, kernel);

    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const candidates: { quad: Quad; area: number }[] = [];

    for (let i = 0; i < contours.size(); i += 1) {
      const contour = contours.get(i);
      const approx = new cv.Mat();
      try {
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        if (approx.rows !== 4) continue;

        const points: Point[] = [];
        for (let r = 0; r < 4; r += 1) {
          points.push({
            x: approx.intPtr(r, 0)[0] / scale,
            y: approx.intPtr(r, 0)[1] / scale,
          });
        }

        const quad = orderCorners(points);
        if (quad === null) continue;
        if (!isPlausibleDocument(quad, width, height)) continue;

        candidates.push({ quad, area: Math.abs(cv.contourArea(approx)) });
      } finally {
        approx.delete();
        contour.delete();
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.area - a.area);
    return candidates[0].quad;
  } finally {
    src.delete();
    work.delete();
    grey.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
}

/**
 * Flatten the quad into a straight rectangle - the step that turns a
 * photograph of a page held at an angle into something that reads like a scan.
 *
 * Draws onto the canvas it is given and returns its size.
 */
export function flatten(cv: Cv, image: ImageData, quad: Quad): ImageData {
  const { width, height } = outputSize(quad);

  const src = cv.matFromImageData(image);
  const dst = new cv.Mat();
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad[0].x, quad[0].y,
    quad[1].x, quad[1].y,
    quad[2].x, quad[2].y,
    quad[3].x, quad[3].y,
  ]);
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    width, 0,
    width, height,
    0, height,
  ]);
  const transform = cv.getPerspectiveTransform(from, to);

  try {
    cv.warpPerspective(
      src,
      dst,
      transform,
      new cv.Size(width, height),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );
    return new ImageData(new Uint8ClampedArray(dst.data), width, height);
  } finally {
    src.delete();
    dst.delete();
    from.delete();
    to.delete();
    transform.delete();
  }
}

export type ScanFilter = 'colour' | 'grey' | 'text';

/**
 * How the finished page looks.
 *
 *   colour  left alone - the only honest choice when a stamp or a signature
 *           is in blue ink and somebody later has to tell original from copy
 *   grey    smaller, still faithful
 *   text    adaptive threshold: paper goes white, ink goes black, the shadow
 *           of the hand holding the page goes away. Reads like a photocopy and
 *           is by far the smallest - but it throws away anything faint, so it
 *           is offered rather than imposed.
 */
export function applyFilter(cv: Cv, image: ImageData, filter: ScanFilter): ImageData {
  if (filter === 'colour') return image;

  const src = cv.matFromImageData(image);
  const grey = new cv.Mat();
  const out = new cv.Mat();

  try {
    cv.cvtColor(src, grey, cv.COLOR_RGBA2GRAY);

    if (filter === 'grey') {
      cv.cvtColor(grey, out, cv.COLOR_GRAY2RGBA);
    } else {
      const thresholded = new cv.Mat();
      try {
        cv.adaptiveThreshold(
          grey,
          thresholded,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          21,
          10,
        );
        cv.cvtColor(thresholded, out, cv.COLOR_GRAY2RGBA);
      } finally {
        thresholded.delete();
      }
    }

    return new ImageData(new Uint8ClampedArray(out.data), image.width, image.height);
  } finally {
    src.delete();
    grey.delete();
    out.delete();
  }
}
