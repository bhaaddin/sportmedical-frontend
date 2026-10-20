/* ══════════════════════════════════════════════════════════════
   SCROLL SCENE - pinned and scrubbed sequences (GSAP ScrollTrigger), for the public website only.

   A scene is a function in its own module that receives the element it belongs to and a bundle of tools:

       // src/motion/scenes/myScene.ts
       import type { SceneContext } from '../ScrollScene';
       export default function myScene({ gsap, ScrollTrigger, root, mm }: SceneContext) {
         mm.add('(min-width: 768px)', () => {
           gsap.fromTo(root.querySelector('[data-sm="title"]'), { y: 80 }, { y: 0, scrollTrigger: { trigger: root, scrub: true } });
         });
       }

       // where it belongs
       <ScrollScene scene={() => import('./scenes/myScene')}>...</ScrollScene>

   Rules this component keeps for you:
     - nothing happens on the server, on the first client render, or until the page has been painted
       (afterFirstPaint, then a pause so the libraries do not parse at once): the markup is the plain, readable page;
     - nothing happens unless the setting is 'plné' (no pin, no scrub in 'omezené' or 'vypnuto');
     - GSAP and the scene are imported dynamically, both gone from every first load;
     - everything the scene created (tweens, triggers, matchMedia listeners, inline styles) is reverted when the
       component unmounts, when the setting changes, or when `sceneKey` (the route) changes;
     - a scene that throws leaves the page as it was and marks the root data-scene="failed".
   ══════════════════════════════════════════════════════════════ */

import { createElement, useEffect, useRef } from 'react';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { STAGE, afterFirstPaintPlus } from './idle';
import { useMotionPreference } from './useMotionPreference';

type Vendor = typeof import('./gsapVendor');

export interface SceneContext {
  gsap: Vendor['gsap'];
  ScrollTrigger: Vendor['ScrollTrigger'];
  /** The element the scene belongs to. */
  root: HTMLElement;
  /** gsap.matchMedia(): add per-breakpoint branches, they revert themselves. */
  mm: ReturnType<Vendor['gsap']['matchMedia']>;
}

export type SceneFn = (context: SceneContext) => void | (() => void);
export type SceneLoader = () => Promise<{ default: SceneFn }>;

/** Marks the root while the scene runs: CSS can switch from the readable layout to the staged one on it. */
export const SCENE_ATTR = 'data-scene';

export function useScrollScene(ref: React.RefObject<HTMLElement | null>, loader: SceneLoader, sceneKey = ''): void {
  const { cinematic } = useMotionPreference();
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const root = ref.current;
    if (root === null || !cinematic) return undefined;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void afterFirstPaintPlus(STAGE.scenes).then(async () => {
      if (cancelled) return;
      try {
        const [vendor, scene] = await Promise.all([import('./gsapVendor'), loaderRef.current()]);
        if (cancelled) return;
        const { gsap, ScrollTrigger } = vendor;
        const mm = gsap.matchMedia();
        const context = gsap.context(() => {
          const extra = scene.default({ gsap, ScrollTrigger, root, mm });
          if (typeof extra === 'function') cleanup = extra;
        }, root);
        root.setAttribute(SCENE_ATTR, 'ready');
        // Layout settles after fonts and images; positions measured before that are wrong.
        const refresh = () => ScrollTrigger.refresh();
        void document.fonts?.ready.then(() => !cancelled && refresh());
        window.addEventListener('load', refresh, { once: true });
        const previous = cleanup;
        cleanup = () => {
          previous?.();
          mm.revert();
          context.revert();
          root.removeAttribute(SCENE_ATTR);
        };
      } catch {
        root.setAttribute(SCENE_ATTR, 'failed');
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
      if (root.getAttribute(SCENE_ATTR) === 'failed') root.removeAttribute(SCENE_ATTR);
    };
  }, [ref, cinematic, sceneKey]);
}

export interface ScrollSceneProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  scene: SceneLoader;
  /** Changes when the scene must be rebuilt (the route). */
  sceneKey?: string;
  as?: ElementType;
  children?: ReactNode;
}

export function ScrollScene({ scene, sceneKey, as = 'div', children, ...rest }: ScrollSceneProps) {
  const ref = useRef<HTMLElement>(null);
  useScrollScene(ref, scene, sceneKey);
  return createElement(as, { ref, ...rest }, children);
}
