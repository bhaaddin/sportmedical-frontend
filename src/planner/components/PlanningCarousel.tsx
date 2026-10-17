/*
 * PlanningCarousel - `section#planning-cards.planning-cards` (prototype line 2996 and
 * `renderPlanningActivities`): the bottom deck with the činnost cards (two visible at a
 * time, `.mode-1/2/scroll`), the crystal arrows, the page dots and - in the same grid - the
 * "Celková objednávka" summary card `.s42-summary-card` with its ring, numbers, mini bars and the
 * Zpět / Připravit formulář buttons.
 *
 * SHELL: only the section with its id / class / position. TO DO by the owner of this file:
 *   - cards from `planCardModel(ctx, categoryId, weekStart, selectedId)` for every
 *     `ctx.demands` entry; click -> `canSelectForPlanning` ('ok' | 'complete' | 'unknown'),
 *     then `act.selectPlanningCategory(id, 'Aktivní: <název>. Táhněte myší v kalendáři.')`
 *     or `act.showCompletion(id, true)`;
 *   - paging with `carouselModel(quantity, state.carousel.index)`, `act.carouselMove(±1, quantity)`,
 *     the horizontal pointer drag (`snapCarouselIndex`) and the scroll fade (`cardVisibility`);
 *   - the live drag figures (`previewedCardFigures`, `previewedSummary`) from `planning.preview` while a
 *     placement drag runs (`selectActivePreview`);
 *   - the summary card from `orderSnapshot(ctx, profile)` / `previewedSummary`; opening it ->
 *     `act.openSummary()` (rendered by SummaryExperience), "Připravit formulář" ->
 *     `act.openDialog({ kind: 'publish' })`, "Zpět" -> clear selection + `{ kind: 'orderDetails' }`;
 *   - arrow art: `CRYSTAL_ARROW_URL` below, set as `--arrow-art: url(...)` on `.precision-bracket`.
 * Pointer-follow tilt (`.fx-surface` custom properties) and arrow hover are pure DOM effects.
 */
import crystalArrowUrl from '../assets/crystal-arrow.png';

/** The arrow bitmap that the prototype inlined as a 80 kB base64 string. */
export const CRYSTAL_ARROW_URL: string = crystalArrowUrl;

export function PlanningCarousel() {
  return (
    <section
      id="planning-cards"
      className="planning-cards"
      aria-label="Výběr činnosti pro přetažení do kalendáře"
      data-testid="planning-carousel"
    />
  );
}
