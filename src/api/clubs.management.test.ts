/* Vedení klubu on the club record (Etapa 12): read tolerantly, missing → []. */
import { describe, expect, it } from 'vitest';
import { readClubManagement } from './clubs';

describe('readClubManagement', () => {
  it('is an empty list for a server that does not send it', () => {
    expect(readClubManagement(undefined)).toEqual([]);
    expect(readClubManagement(null)).toEqual([]);
    expect(readClubManagement({})).toEqual([]);
  });

  it('reads rows, trims, drops the nameless and treats an unknown source as manual', () => {
    expect(readClubManagement([
      { id: 'm1', fullName: ' Jan Novák ', role: 'předseda', phone: '', email: 'j@x.cz', source: 'ares' },
      { fullName: 'Eva', source: 'whatever' },
      { role: 'nikdo' },
      'x',
    ])).toEqual([
      { id: 'm1', fullName: 'Jan Novák', role: 'předseda', phone: null, email: 'j@x.cz', source: 'ares' },
      { fullName: 'Eva', role: '', phone: null, email: null, source: 'manual' },
    ]);
  });
});
