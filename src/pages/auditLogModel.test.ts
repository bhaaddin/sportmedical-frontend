import { describe, expect, it } from 'vitest';
import { auditSubject } from './auditLogModel';

describe('auditSubject: the thing an entry is about, when a chip can open it', () => {
  it.each([
    ['Patient', 'patient'],
    ['Invoice', 'invoice'],
    ['Club', 'club'],
    ['ClubOrder', 'order'],
    ['ClinicService', 'service'],
    ['Activity', 'activity'],
  ] as const)('%s becomes a %s chip', (entity, kind) => {
    expect(auditSubject({ entity, entityId: 'abcdef12-3456-7890' })).toEqual({ kind, id: 'abcdef12-3456-7890', label: 'abcdef12' });
  });

  it('labels it with the first eight characters of the id, never a name', () => {
    expect(auditSubject({ entity: 'Patient', entityId: 'abc' })?.label).toBe('abc');
    expect(auditSubject({ entity: 'Patient', entityId: '  0123456789abcdef  ' })?.id).toBe('0123456789abcdef');
  });

  it('is null for a setting, an account, a session ...', () => {
    expect(auditSubject({ entity: 'Setting', entityId: 'x1' })).toBeNull();
    expect(auditSubject({ entity: 'UserAccount', entityId: 'x1' })).toBeNull();
  });

  it('is null without an entity or an id', () => {
    expect(auditSubject({ entity: 'Patient', entityId: '' })).toBeNull();
    expect(auditSubject({ entity: 'Patient', entityId: '   ' })).toBeNull();
    expect(auditSubject({ entity: 'Patient', entityId: null })).toBeNull();
    expect(auditSubject({ entity: null, entityId: 'x' })).toBeNull();
    expect(auditSubject({})).toBeNull();
  });
});
