/*
 * The stored choice is read defensively and written only when it changed,
 * and the doctor's workspace opens for the right people.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPreferences,
  opensDoctorWorkspace,
  parsePreferences,
  preferencesSnapshot,
  savePreferences,
  subscribePreferences,
} from './preferences';

describe('parsePreferences', () => {
  it('reads the defaults from nothing', () => {
    expect(parsePreferences(null)).toEqual({ theme: 'clinic-light', workspace: 'full' });
  });

  it('reads what the server said', () => {
    expect(parsePreferences(JSON.stringify({ theme: 'contrast-dark', workspace: 'doctor' }))).toEqual({
      theme: 'contrast-dark',
      workspace: 'doctor',
    });
  });

  it('replaces an unknown field alone, and survives garbage', () => {
    expect(parsePreferences(JSON.stringify({ theme: 'retired', workspace: 'doctor' }))).toEqual({
      theme: 'clinic-light',
      workspace: 'doctor',
    });
    expect(parsePreferences('{not json')).toEqual({ theme: 'clinic-light', workspace: 'full' });
    expect(parsePreferences('42')).toEqual({ theme: 'clinic-light', workspace: 'full' });
  });
});

describe('the store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('writes, notifies, and does not notify for the same value twice', () => {
    const listener = vi.fn();
    const stop = subscribePreferences(listener);

    savePreferences({ theme: 'calm-warm', workspace: 'full' });
    savePreferences({ theme: 'calm-warm', workspace: 'full' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(parsePreferences(preferencesSnapshot())).toEqual({ theme: 'calm-warm', workspace: 'full' });

    clearPreferences();
    expect(preferencesSnapshot()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it('ignores a missing answer rather than storing "undefined"', () => {
    savePreferences(undefined);
    savePreferences(null);
    expect(preferencesSnapshot()).toBeNull();
  });
});

describe('opensDoctorWorkspace', () => {
  it('opens for Staff by default and for anybody who chose it', () => {
    expect(opensDoctorWorkspace('Staff', 'full')).toBe(true);
    expect(opensDoctorWorkspace('Owner', 'full')).toBe(false);
    expect(opensDoctorWorkspace('Administrator', 'full')).toBe(false);
    expect(opensDoctorWorkspace('Owner', 'doctor')).toBe(true);
    expect(opensDoctorWorkspace(undefined, 'full')).toBe(true);
  });
});
