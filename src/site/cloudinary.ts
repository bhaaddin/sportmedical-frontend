/* ══════════════════════════════════════════════════════════════
   CLOUDINARY-STYLE RESPONSIVE URLS

   Media is stored behind IMediaStore (Cloudinary today). When — and only when —
   a file's host is res.cloudinary.com, the browser is offered several widths by
   inserting a transformation segment after "/upload/" (f_auto picks AVIF/WebP,
   q_auto the quality, w_<n>,c_limit never enlarges). Any other host is served as
   it is: we do not know how to resize it.
   ══════════════════════════════════════════════════════════════ */

export const CLOUDINARY_HOST = 'res.cloudinary.com';

/** Widths offered in `srcset`. */
export const IMAGE_WIDTHS = [480, 768, 1200, 1600] as const;

export function isCloudinaryUrl(url: string): boolean {
  try {
    return new URL(url).hostname === CLOUDINARY_HOST;
  } catch {
    return false;
  }
}

/** The same image at a given width, or the URL unchanged when it is not a Cloudinary image URL. */
export function cloudinaryWidth(url: string, width: number): string {
  if (!isCloudinaryUrl(url)) return url;
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at < 0) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  return `${head}f_auto,q_auto,w_${width},c_limit/${tail}`;
}

/** `srcset` for an image, or undefined when widths cannot be requested. */
export function imageSrcSet(url: string): string | undefined {
  if (!isCloudinaryUrl(url) || !url.includes('/image/upload/')) return undefined;
  return IMAGE_WIDTHS.map((width) => `${cloudinaryWidth(url, width)} ${width}w`).join(', ');
}
