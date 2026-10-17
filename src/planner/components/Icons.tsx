/*
 * The prototype's `<svg class="svg-sprite">` with its 22 `<symbol id="icon-*">`
 * entries, plus a small `<Icon />` that references them.
 *
 * Render `<Icons />` ONCE per page (PlannerShell does); the symbols are looked
 * up by document-wide id, exactly like in the prototype.
 */
import { IconSymbols, ICON_NAMES, type IconName } from './IconSprite.generated';

export { ICON_NAMES };
export type { IconName };

export function Icons() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="svg-sprite" data-testid="planner-icons">
      <IconSymbols />
    </svg>
  );
}

/**
 * `<svg class="icon"><use href="#icon-NAME"/></svg>`.
 * `name` is a sprite key; a činnost's `iconKey` is one (unknown keys draw nothing).
 */
export function Icon({ name, className = 'icon' }: { name: IconName | string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#icon-${name}`} />
    </svg>
  );
}
