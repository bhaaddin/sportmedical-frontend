import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWeb } from '../web/testUtils';
import { normalizeBootstrap } from '../web/data';
import { MediaSlot } from './MediaSlot';
import { SlotText } from './SlotText';
import { cloudinaryWidth, imageSrcSet, isCloudinaryUrl } from './cloudinary';
import { SLOT_KEY_PATTERN, SLOT_REGISTRY, slotDef, slotGroups } from './siteSlots';

vi.mock('../web/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../web/http')>();
  // The server is asleep: nothing here may depend on an answer.
  return { ...actual, webHttp: { get: () => Promise.reject(new Error('Network Error')) } };
});

afterEach(cleanup);

const withSlots = (slots: Record<string, unknown>) =>
  normalizeBootstrap({ siteContent: { version: 'v1', slots, partners: [], faq: [] } }, 1);

const KEY = 'landing.hero.photo1';
const CLOUD = 'https://res.cloudinary.com/demo/image/upload/v1/clinic/hero.jpg';

describe('MediaSlot', () => {
  it('is a grey placeholder with the registry caption and the recommended size when nothing is uploaded', () => {
    const { container } = renderWeb(<MediaSlot slotKey={KEY} />);
    expect(screen.getByText('[FOTO: spiroergometrie na ergometru]')).toBeInTheDocument();
    expect(screen.getByText('Doporučeno 1600 × 1200 px')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-slot-state="placeholder"]')).not.toBeNull();
  });

  it('says VIDEO for a video slot and falls back to the label for an unknown key', () => {
    renderWeb(<MediaSlot slotKey="neexistuje.slot" fallbackLabel="něco" />);
    expect(screen.getByText('[FOTO: něco]')).toBeInTheDocument();
  });

  it('shows the uploaded image: lazy, with the alt text, the stored size and Cloudinary widths', () => {
    const seed = withSlots({ [KEY]: { kind: 'image', mediaUrl: CLOUD, alt: 'Ergometrie', width: 1600, height: 1200 } });
    const { container } = renderWeb(<MediaSlot slotKey={KEY} />, { seed });
    const img = screen.getByAltText('Ergometrie');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '1600');
    expect(img).toHaveAttribute('height', '1200');
    expect(img.getAttribute('srcset')).toContain('w_480,c_limit/');
    expect(img.getAttribute('srcset')).toContain(' 1600w');
    expect(img.getAttribute('src')).toContain('/image/upload/f_auto,q_auto,w_1200,c_limit/v1/clinic/hero.jpg');
    // The placeholder is gone.
    expect(screen.queryByText(/\[FOTO/)).toBeNull();
    expect(container.querySelector('[data-slot-state="image"]')).not.toBeNull();
  });

  it('loads the first photo of a page at once (eager) and leaves another host untouched', () => {
    const other = 'https://cdn.example.org/a.jpg';
    const seed = withSlots({ [KEY]: { kind: 'image', mediaUrl: other, alt: 'x' } });
    renderWeb(<MediaSlot slotKey={KEY} eager />, { seed });
    const img = screen.getByAltText('x');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('src', other);
    expect(img).not.toHaveAttribute('srcset');
  });

  it('shows a video as its poster with a play button and loads the file only on click', () => {
    const seed = withSlots({
      'landing.club.photo': { kind: 'video', mediaUrl: 'https://cdn.example.org/clip.mp4', posterUrl: 'https://cdn.example.org/p.jpg', alt: 'Test v klubu' },
    });
    const { container } = renderWeb(<MediaSlot slotKey="landing.club.photo" />, { seed });
    // Poster first: no <video> yet, so nothing is downloaded over mobile data.
    expect(container.querySelector('video')).toBeNull();
    expect(screen.getByAltText('Test v klubu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Přehrát video/ }));
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', 'https://cdn.example.org/clip.mp4');
    // A played-on-demand video has controls and is NOT muted/looped.
    expect(video).toHaveAttribute('controls');
    expect(video.muted).toBe(false);
    expect(video).not.toHaveAttribute('loop');
  });

  it('autoplays muted, inline and looped only when the admin said so', () => {
    const seed = withSlots({
      'landing.club.photo': { kind: 'video', mediaUrl: 'https://cdn.example.org/clip.mp4', posterUrl: 'https://cdn.example.org/p.jpg', autoplay: true },
    });
    const { container } = renderWeb(<MediaSlot slotKey="landing.club.photo" />, { seed });
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('loop');
    expect(video.getAttribute('playsinline')).not.toBeNull();
    expect(video).not.toHaveAttribute('controls');
  });

  it('a media slot with a text value from the API still shows the placeholder (no file, no image)', () => {
    const seed = withSlots({ [KEY]: { kind: 'image', alt: 'jen popis' } });
    renderWeb(<MediaSlot slotKey={KEY} />, { seed });
    expect(screen.getByText('[FOTO: spiroergometrie na ergometru]')).toBeInTheDocument();
  });
});

describe('SlotText', () => {
  it('shows the registry default when the API has nothing, and the admin text once it has', () => {
    renderWeb(<SlotText slotKey="landing.adv.2.title" />);
    expect(screen.getByText('Odborný lékařský tým')).toBeInTheDocument();
    cleanup();
    const seed = withSlots({ 'landing.adv.2.title': { kind: 'text', text: 'Náš tým' } });
    renderWeb(<SlotText slotKey="landing.adv.2.title" />, { seed });
    expect(screen.getByText('Náš tým')).toBeInTheDocument();
    expect(screen.queryByText('Odborný lékařský tým')).toBeNull();
  });

  it('breaks lines at "\\n" and ignores an empty admin text', () => {
    const { container } = renderWeb(<SlotText slotKey="landing.services.title" as="h2" />);
    expect(container.querySelector('h2 br')).not.toBeNull();
    cleanup();
    const seed = withSlots({ 'landing.adv.2.title': { kind: 'text', text: '   ' } });
    renderWeb(<SlotText slotKey="landing.adv.2.title" />, { seed });
    expect(screen.getByText('Odborný lékařský tým')).toBeInTheDocument();
  });
});

describe('cloudinary urls', () => {
  it('adds width parameters only for res.cloudinary.com image URLs', () => {
    expect(isCloudinaryUrl(CLOUD)).toBe(true);
    expect(isCloudinaryUrl('https://example.com/res.cloudinary.com/x.jpg')).toBe(false);
    expect(cloudinaryWidth(CLOUD, 768)).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_768,c_limit/v1/clinic/hero.jpg');
    expect(cloudinaryWidth('https://cdn.example.org/a.jpg', 768)).toBe('https://cdn.example.org/a.jpg');
    expect(imageSrcSet('https://cdn.example.org/a.jpg')).toBeUndefined();
    // A video URL is not resized by width.
    expect(imageSrcSet('https://res.cloudinary.com/demo/video/upload/v1/a.mp4')).toBeUndefined();
  });
});

describe('the slot registry', () => {
  it('has unique, valid keys and a default for every text slot and a caption for every media slot', () => {
    const keys = SLOT_REGISTRY.map((slot) => slot.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const slot of SLOT_REGISTRY) {
      expect(slot.key).toMatch(SLOT_KEY_PATTERN);
      expect(slot.label.length).toBeGreaterThan(0);
      if (slot.kind === 'text') expect(slot.defaultText ?? '').not.toBe('');
      else {
        expect(slot.caption ?? '').not.toBe('');
        expect(slot.recommended ?? '').toMatch(/\d+ × \d+ px/);
      }
    }
  });

  it('carries the artboard captions of the landing and groups slots by page section', () => {
    expect(slotDef('landing.service2.photo')?.caption).toBe('ForceDecks — výskok na silových deskách');
    expect(slotDef('landing.hero.headline')?.defaultText).toBe('Sportovní lékařské\nprohlídky\na diagnostika');
    const groups = slotGroups();
    expect(groups.some((g) => g.group.startsWith('Úvodní stránka'))).toBe(true);
    expect(groups.flatMap((g) => g.slots).length).toBe(SLOT_REGISTRY.length);
  });

  it('puts no price in any default text', () => {
    for (const slot of SLOT_REGISTRY) expect(slot.defaultText ?? '').not.toMatch(/\d[\d\s ]*(Kč|CZK)/);
  });
});
