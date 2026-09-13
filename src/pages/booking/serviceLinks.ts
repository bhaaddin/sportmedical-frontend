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

export interface LinkChanges {
  /** Move these under this service. */
  attach: string[];
  /** Take these away from it. Always empty for činnosti - see the note above. */
  detach: string[];
}

/**
 * The difference between what is under the service and what was ticked.
 *
 * `canDetach` is the server's rule, passed in rather than guessed: false for
 * činnosti, true for kalendáře. With it false, unticking is simply not a
 * change - the screen does not offer it and this will not invent it either.
 */
export function linkChanges(
  items: readonly LinkableItem[],
  serviceId: string,
  chosen: readonly string[],
  canDetach: boolean,
): LinkChanges {
  const now = new Set(under(items, serviceId));
  const wanted = new Set(chosen);

  const attach = [...wanted].filter((id) => !now.has(id));
  const detach = canDetach ? [...now].filter((id) => !wanted.has(id)) : [];

  return { attach, detach };
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

/** Nothing ticked and nothing unticked is a save with no links to write. */
export function nothingToApply(changes: LinkChanges): boolean {
  return changes.attach.length === 0 && changes.detach.length === 0;
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
