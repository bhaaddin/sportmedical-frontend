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
import { handoffFrom, handoffIsOfferable } from './serviceHandoff';

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
