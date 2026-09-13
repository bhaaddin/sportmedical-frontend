/*
 * Ticking what belongs under a služba, from the služba.
 *
 * The owner asked for this twice. The first version told him to edit each
 * calendar; the second sent him to a list to do it one row at a time. Neither
 * was what the server needed - it was what my screen insisted on.
 *
 * The one rule that is genuinely the server's: a činnost must belong to a
 * service, so it can be moved here and never freed. These guard that the
 * screen never invents an action ending in a 400, and that a move is called a
 * move rather than looking like a copy.
 */
import { describe, it, expect } from 'vitest';
import {
  linkChanges, movedFrom, nothingToApply, offerable, partialFailureText, under,
} from './serviceLinks';
import type { LinkableItem } from './serviceLinks';

const item = (id: string, over: Partial<LinkableItem> = {}): LinkableItem => ({
  id,
  name: `Položka ${id}`,
  isActive: true,
  clinicServiceId: null,
  ...over,
});

describe('what is under a service now', () => {
  it('finds the ones pointing at it', () => {
    const items = [item('a', { clinicServiceId: 's1' }), item('b'), item('c', { clinicServiceId: 's2' })];
    expect(under(items, 's1')).toEqual(['a']);
  });

  it('finds none when nothing points at it', () => {
    expect(under([item('a'), item('b')], 's1')).toEqual([]);
  });
});

describe('what may be ticked', () => {
  it('offers the ones still in use', () => {
    const items = [item('a'), item('b', { isActive: false })];
    expect(offerable(items, 's1').map((i) => i.id)).toEqual(['a']);
  });

  /*
   * The exception, and it matters: a retired one already under this service
   * stays on the list. Dropping it would make the service look as though it
   * has less under it than it does, and unticking would then be the only way
   * to save - silently taking it away.
   */
  it('keeps a retired one that is already under this service', () => {
    const items = [item('a', { isActive: false, clinicServiceId: 's1' })];
    expect(offerable(items, 's1').map((i) => i.id)).toEqual(['a']);
  });

  it('does not keep a retired one under a different service', () => {
    const items = [item('a', { isActive: false, clinicServiceId: 's2' })];
    expect(offerable(items, 's1')).toEqual([]);
  });
});

describe('what the ticks mean', () => {
  const items = [
    item('a', { clinicServiceId: 's1' }),
    item('b'),
    item('c', { clinicServiceId: 's2' }),
  ];

  it('moves in the newly ticked', () => {
    expect(linkChanges(items, 's1', ['a', 'b'], true))
      .toEqual({ attach: ['b'], detach: [] });
  });

  it('takes away the unticked, where the server allows it', () => {
    expect(linkChanges(items, 's1', [], true))
      .toEqual({ attach: [], detach: ['a'] });
  });

  /*
   * A činnost must belong to a service, so unticking one has nowhere to put
   * it. The screen does not offer that, and this does not invent it either -
   * the two have to agree, or a save would send a `null` the server refuses.
   */
  it('never takes a činnost away, because the server refuses one with no service', () => {
    expect(linkChanges(items, 's1', [], false))
      .toEqual({ attach: [], detach: [] });
  });

  it('still moves činnosti in', () => {
    expect(linkChanges(items, 's1', ['a', 'c'], false))
      .toEqual({ attach: ['c'], detach: [] });
  });

  it('calls no change no change', () => {
    expect(nothingToApply(linkChanges(items, 's1', ['a'], true))).toBe(true);
    expect(nothingToApply(linkChanges(items, 's1', ['a', 'b'], true))).toBe(false);
  });
});

describe('saying that a tick moves something', () => {
  const items = [
    item('a', { clinicServiceId: 's2' }),
    item('b'),
  ];
  const nameOf = (id: string) => (id === 's2' ? 'Sportovní diagnostika' : null);

  /* It is not a copy. The other service loses it, and that is worth seeing
     while ticking rather than on the other service's card afterwards. */
  it('names the service it would be taken from', () => {
    expect(movedFrom(items, 'a', nameOf)).toBe('Sportovní diagnostika');
  });

  it('says nothing for one that belongs nowhere yet', () => {
    expect(movedFrom(items, 'b', nameOf)).toBeNull();
  });

  it('says nothing for one it cannot find', () => {
    expect(movedFrom(items, 'zzz', nameOf)).toBeNull();
  });

  /* A service that has since been deleted has no name to give. */
  it('says nothing when the old service cannot be named', () => {
    expect(movedFrom([item('a', { clinicServiceId: 'gone' })], 'a', nameOf)).toBeNull();
  });
});

describe('when only some of the writes go through', () => {
  /*
   * Several `PUT`s behind one button makes partial success a real outcome,
   * and the worst thing the dialog could do is close and look finished.
   */
  it('names the one that failed', () => {
    expect(partialFailureText(['Ordinace'])).toContain('Ordinace');
    expect(partialFailureText(['Ordinace'])).toContain('Ostatní změny jsou uložené');
  });

  /* Names, not a count: "2 se nepodařilo" leaves somebody to work out which. */
  it('names all of them', () => {
    const text = partialFailureText(['Ordinace', 'Laboratoř zátěže']);
    expect(text).toContain('Ordinace');
    expect(text).toContain('Laboratoř zátěže');
  });

  it('says nothing when everything went through', () => {
    expect(partialFailureText([])).toBe('');
  });
});
