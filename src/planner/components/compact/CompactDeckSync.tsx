/*
 * CompactDeckSync - keeps the carousel's page in step with a finger.
 *
 * The deck (`PlanningCarousel`) scrolls to `carousel.index * step` on every render, which is right for the stage's
 * arrows and mouse drag. On a touch screen the finger scrolls the strip natively (scroll snap), so once the strip
 * has come to rest this tells the store which page it rests on - otherwise the deck's own effect would pull the strip
 * back to the page the store still has. A real page change ends the armed činnost, exactly like the arrows do.
 * Renders nothing.
 */
import { useEffect } from 'react';
import { usePlannerActions } from '../../state/PlannerStoreProvider';
import { usePlanFigures } from '../plan/usePlanFigures';

export function CompactDeckSync() {
  const act = usePlannerActions();
  const quantity = usePlanFigures().base.list.length;

  useEffect(() => {
    const viewport = document.getElementById('adaptive-viewport');
    if (!viewport || quantity < 3) return undefined;
    let timer: number | undefined;
    const settle = () => {
      const card = viewport.querySelector<HTMLElement>('.plan-card');
      const track = viewport.querySelector<HTMLElement>('.adaptive-card-track');
      if (!card || !track) return;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      const step = card.getBoundingClientRect().width + gap;
      if (step > 0) act.carouselTo(Math.round(viewport.scrollLeft / step), quantity);
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 140);
    };
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [act, quantity]);

  return null;
}
