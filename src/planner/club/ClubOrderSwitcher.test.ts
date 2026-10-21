import { describe, expect, it } from 'vitest';
import { switcherLabel } from './ClubOrderSwitcher';

describe('switcherLabel - never stale after a save (owner: everything connected)', () => {
  it('a new order on the stage is "Nová objednávka" until it is saved, then it carries its code at once', () => {
    expect(switcherLabel({ adhoc: 'new', selectedCode: null, savedCode: null })).toBe('Nová objednávka');
    expect(switcherLabel({ adhoc: 'new', selectedCode: null, savedCode: 'KO-BA2277A5' })).toBe('Objednávka KO-BA2277A5');
  });
  it('a selected order names its code; none says so', () => {
    expect(switcherLabel({ adhoc: null, selectedCode: 'KO-1', savedCode: null })).toBe('Objednávka KO-1');
    expect(switcherLabel({ adhoc: 'edit', selectedCode: 'KO-2', savedCode: 'KO-2' })).toBe('Objednávka KO-2');
    expect(switcherLabel({ adhoc: null, selectedCode: null, savedCode: null })).toBe('Žádná objednávka');
  });
});
