/*
 * Turning what a camera or a file picker gives us into something a server can
 * store: rotation and iPhone photos.
 *
 * Browser work, so it is not unit tested - `services/documentFile.ts` holds
 * the rules that can be. What is here is kept small and each piece does one
 * thing, so that when something does go wrong on a real phone there is one
 * obvious place to look.
 */
import { normaliseRotation, rotatedSize } from './documentRotation';

/**
 * Draw a canvas rotated onto a new one.
 *
 * Rotation is kept as a separate step and applied at the end rather than baked
 * in on capture, so somebody can turn a page and turn it back without losing
 * anything. A phone writes its orientation into the photo's metadata, and that
 * metadata is gone the moment the image is drawn onto a canvas - which is why
 * a button exists at all, instead of trusting the camera.
 */
export function rotateCanvas(source: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const degrees = normaliseRotation(quarterTurns);
  if (degrees === 0) return source;

  const size = rotatedSize(source.width, source.height, degrees);
  const out = document.createElement('canvas');
  out.width = size.width;
  out.height = size.height;

  const ctx = out.getContext('2d');
  if (ctx === null) return source;

  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

/** A canvas as a file, ready to upload. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error('Obrázek se nepodařilo uložit.')) : resolve(blob)),
      type,
      quality,
    );
  });
}

/**
 * An iPhone photo as a JPEG.
 *
 * Loaded on demand: most uploads are not HEIC, and this is a decoder nobody
 * else needs. Safari can often display HEIC natively, but "often" is not a
 * basis for accepting a patient's medical record - the conversion makes the
 * result the same on every browser.
 */
export async function heicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import('heic-to');
  const converted = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
  const name = file.name.replace(/\.(heic|heif)$/i, '.jpg');
  return new File([converted], name, { type: 'image/jpeg' });
}

/** Load a file into an image element, and revoke the object URL either way. */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Obrázek se nepodařilo načíst.'));
    };
    image.src = url;
  });
}

export function imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  return canvas;
}
