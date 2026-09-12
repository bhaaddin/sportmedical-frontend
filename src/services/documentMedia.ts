/*
 * Turning what a camera or a file picker gives us into something a server can
 * store: rotation, iPhone photos, and several scanned pages as one PDF.
 *
 * Browser work, so it is not unit tested - `services/documentFile.ts` holds
 * the rules that can be. What is here is kept small and each piece does one
 * thing, so that when something does go wrong on a real phone there is one
 * obvious place to look.
 */
import { jsPDF } from 'jspdf';
import { normaliseRotation, rotatedSize } from '../components/scanner/geometry';

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

/**
 * Several scanned pages as one PDF.
 *
 * One file rather than five, because a výpis is several sheets and filing them
 * as five separate documents means the next person has to work out which five
 * belong together - and the paperwork rule counts documents, not pages.
 *
 * Each page gets its own page size matching its own aspect, so a landscape
 * sheet scanned among portrait ones is not letterboxed or stretched.
 */
export async function pagesToPdf(pages: HTMLCanvasElement[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('Není co uložit — zatím nemáte žádnou stránku.');

  const first = pages[0];
  const doc = new jsPDF({
    orientation: first.width >= first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
    compress: true,
  });

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    if (i > 0) {
      doc.addPage([page.width, page.height], page.width >= page.height ? 'landscape' : 'portrait');
    }
    doc.addImage(page.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, page.width, page.height);
  }

  return doc.output('blob');
}

/**
 * The rear camera, at the highest resolution the device will give.
 *
 * `ideal` rather than `exact` throughout: a laptop has one camera and no
 * "environment" facing mode, and `exact` would fail outright there rather than
 * falling back - leaving the scanner broken on the machine sitting on the
 * reception desk.
 */
export function openCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  });
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Why the camera did not open, in words somebody can act on. */
export function cameraErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Přístup ke kameře je zamítnutý. Povolte ho prosím v nastavení prohlížeče u této stránky — nebo použijte nahrání souboru.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Na tomhle zařízení jsme nenašli kameru. Použijte prosím nahrání souboru.';
    case 'NotReadableError':
      return 'Kameru právě používá jiná aplikace. Zavřete ji prosím a zkuste to znovu.';
    default:
      return 'Kameru se nepodařilo otevřít. Použijte prosím nahrání souboru.';
  }
}
