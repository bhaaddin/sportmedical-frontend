/*
 * Assigning činnosti and kalendáře to a služba from the služba itself.
 *
 * The owner asked for this twice and was right both times. The first version
 * told him to go and edit each calendar; the second sent him to a list to do
 * the same thing one row at a time. His words: "to mi fakt nevies spravit do
 * pcici okienko rozrolovacie kde si to uz len vybriem ?? ved ako to robia
 * profesionaly". That is how every booking system does it - the service is
 * where you tick what belongs under it.
 *
 * The server keeps the link on the other side, so this is several `PUT`s
 * behind one button. That is a screen's job, not his.
 *
 * ONE ASYMMETRY, AND IT IS THE SERVER'S, NOT A CHOICE MADE HERE
 *
 *     činnost   clinicServiceId is required   can be moved here, never freed
 *     kalendář  clinicServiceId is nullable   can be assigned and taken away
 *
 * A činnost belongs to exactly one service and the server refuses it without
 * one, so unticking one here would have nowhere to put it. It stays ticked and
 * the screen says why, rather than offering an action that ends in a 400.
 */

export interface LinkableItem {
  id: string;
  name: string;
  isActive: boolean;
  clinicServiceId: string | null;
}

/** Which of them sit under this service right now. */
export function under(items: readonly LinkableItem[], serviceId: string): string[] {
  return items.filter((i) => i.clinicServiceId === serviceId).map((i) => i.id);
}

/**
 * What can be offered for ticking.
 *
 * Retired ones are left out, with one exception: one that is already under
 * this service stays, because hiding it would make the list say the service
 * has less under it than it does.
 */
export function offerable(
  items: readonly LinkableItem[],
  serviceId: string,
): LinkableItem[] {
  return items.filter((i) => i.isActive || i.clinicServiceId === serviceId);
}

/**
 * Which of the ticked ones have to be written.
 *
 * Only ever an addition. Neither a činnost nor a kalendář may be left without
 * a service - booking put the same rule on both, and for the same reason: one
 * with no service offers nothing on any day and says nothing about why. A
 * field that must not be empty must not have a road back to empty either, or
 * the rule holds only until the next save.
 *
 * So a row already under this service cannot be unticked, and the only way
 * something leaves is by being ticked on another service. That is also what
 * anybody actually wants - "move it to Diagnostika", never "leave it with
 * nothing".
 *
 * Measured on the live contract on 14. 9. 2026, because the running API is
 * behind the code and still allows the empty state:
 *
 *     SaveCalendar.required          [name, color, location, displayStep, sortOrder]
 *     SaveCalendar.clinicServiceId   ['null','string']
 *
 * When `clinicServiceId` appears in `required` and stops accepting null, the
 * server has caught up with the rule this screen already follows.
 */
export function toAttach(
  items: readonly LinkableItem[],
  serviceId: string,
  chosen: readonly string[],
): string[] {
  const now = new Set(under(items, serviceId));
  return chosen.filter((id) => !now.has(id));
}

/**
 * What ticking this one would actually do, said before the save.
 *
 * A činnost or calendar already under another service does not get copied -
 * it moves, and the other service loses it. That is a consequence worth
 * seeing at the moment of ticking rather than discovering on the other
 * service's card afterwards.
 */
export function movedFrom(
  items: readonly LinkableItem[],
  id: string,
  serviceNameOf: (serviceId: string) => string | null,
): string | null {
  const item = items.find((i) => i.id === id);
  if (item === undefined) return null;
  if (item.clinicServiceId === null) return null;
  return serviceNameOf(item.clinicServiceId);
}

/**
 * What to say when some of the `PUT`s went through and others did not.
 *
 * Several writes behind one button means partial success is a real outcome,
 * and the worst thing the screen could do is close and look finished. The
 * names, not a count: "2 se nepodařilo" leaves somebody to work out which.
 */
export function partialFailureText(failedNames: readonly string[]): string {
  if (failedNames.length === 0) return '';
  return failedNames.length === 1
    ? `Nepodařilo se uložit: ${failedNames[0]}. Ostatní změny jsou uložené.`
    : `Nepodařilo se uložit: ${failedNames.join(', ')}. Ostatní změny jsou uložené.`;
}
