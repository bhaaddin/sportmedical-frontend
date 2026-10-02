/*
 * The way from a service that is missing something to the screen that adds it.
 *
 * The owner opened "Upravit službu", looked for somewhere to assign činnosti,
 * and there was none - because the server takes that link from the other side
 * only. The screen was telling him to do something it gave him no way to do.
 *
 * These guard the carry: that a real handoff arrives, that junk in router
 * state opens nothing, and that a service which is no longer offered is
 * dropped rather than pre-selected into a save that can never go.
 */
import { describe, it, expect } from 'vitest';
import { assignableCount, handoffAction, handoffFrom, handoffIsOfferable } from './serviceHandoff';

describe('reading the handoff out of router state', () => {
  it('finds the service that was handed over', () => {
    expect(handoffFrom({ clinicServiceId: 's1' })).toBe('s1');
  });

  /*
   * `useLocation().state` is whatever the last navigation left there - null on
   * a fresh load, anything at all after a back button. A screen that trusts
   * its shape opens a dialog on a page somebody simply opened.
   */
  it('finds nothing in the state of a page opened normally', () => {
    expect(handoffFrom(null)).toBeNull();
    expect(handoffFrom(undefined)).toBeNull();
  });

  it('finds nothing in state that is not an object', () => {
    expect(handoffFrom('s1')).toBeNull();
    expect(handoffFrom(42)).toBeNull();
  });

  it('finds nothing in state carrying something else entirely', () => {
    expect(handoffFrom({ from: '/sluzby', scrollY: 120 })).toBeNull();
  });

  it('refuses a value that is not a string', () => {
    expect(handoffFrom({ clinicServiceId: 7 })).toBeNull();
    expect(handoffFrom({ clinicServiceId: null })).toBeNull();
  });

  /* An empty id would pre-select nothing and leave the save shut, which reads
     as a broken dialog rather than as a plain new one. */
  it('refuses an empty or blank id', () => {
    expect(handoffFrom({ clinicServiceId: '' })).toBeNull();
    expect(handoffFrom({ clinicServiceId: '   ' })).toBeNull();
  });
});

describe('whether the handed-over service can still be chosen', () => {
  const services = [
    { id: 's1', isActive: true },
    { id: 's9', isActive: false },
  ];

  it('says yes for one still in use', () => {
    expect(handoffIsOfferable('s1', services)).toBe(true);
  });

  /*
   * The picker does not list a retired service, so pre-selecting one opens a
   * dialog showing nothing with a save button that never moves. Opening plain
   * is the better failure.
   */
  it('says no for a retired one', () => {
    expect(handoffIsOfferable('s9', services)).toBe(false);
  });

  it('says no for one that is gone', () => {
    expect(handoffIsOfferable('deleted', services)).toBe(false);
  });

  /*
   * Still loading is not "no". Answering no here would drop every handoff
   * that arrives before the services do - which is all of them, since the
   * navigation and the request start together.
   */
  it('says neither while the services are still on their way', () => {
    expect(handoffIsOfferable('s1', undefined)).toBeNull();
  });

  it('says no once they have arrived and there are none', () => {
    expect(handoffIsOfferable('s1', [])).toBe(false);
  });
});

describe('what arriving with a handoff should do', () => {
  const services = [{ id: 's1', isActive: true }, { id: 's9', isActive: false }];

  /*
   * The bug the owner sent back. He clicked "Přiřadit kalendář" on a clinic
   * that already had three calendars and was asked to build a fourth - the
   * three were never shown. The server never wanted that: `PUT` on a calendar
   * takes `clinicServiceId`, so pointing an existing one at the service is an
   * ordinary edit. Only the screen was insisting.
   */
  it('offers what exists rather than a blank form', () => {
    expect(handoffAction('s1', services, 3)).toBe('assign');
  });

  it('opens a blank form only when there is nothing to assign', () => {
    expect(handoffAction('s1', services, 0)).toBe('new');
  });

  it('does nothing without a handoff', () => {
    expect(handoffAction(null, services, 0)).toBe('none');
  });

  it('does nothing for a service that is no longer offered', () => {
    expect(handoffAction('s9', services, 0)).toBe('none');
    expect(handoffAction('gone', services, 3)).toBe('none');
  });

  /*
   * Deciding on a list that has not arrived is deciding there is nothing to
   * assign - the same wrong answer, one moment earlier. Both halves have to
   * be in before anything happens.
   */
  it('does nothing while the list is still on its way', () => {
    expect(handoffAction('s1', services, undefined)).toBe('none');
  });

  it('does nothing while the services are still on their way', () => {
    expect(handoffAction('s1', undefined, 0)).toBe('none');
  });
});

describe('counting what could take the service instead', () => {
  const item = (over: Record<string, unknown> = {}) =>
    ({ clinicServiceId: null, isActive: true, ...over }) as
      { clinicServiceId: string | null; isActive: boolean };

  it('counts the ones going spare', () => {
    expect(assignableCount([item(), item()], 's1')).toBe(2);
  });

  /* Already on this service is not what is missing. */
  it('does not count one already on this service', () => {
    expect(assignableCount([item({ clinicServiceId: 's1' }), item()], 's1')).toBe(1);
  });

  /* A retired one is not offered for anything else here either, and counting
     it would land somebody on a list that does not show it. */
  it('does not count a retired one', () => {
    expect(assignableCount([item({ isActive: false })], 's1')).toBe(0);
  });

  it('counts one that belongs to another service', () => {
    expect(assignableCount([item({ clinicServiceId: 's2' })], 's1')).toBe(1);
  });

  it('counts nothing in an empty list', () => {
    expect(assignableCount([], 's1')).toBe(0);
  });
});
