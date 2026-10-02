import { describe, expect, it } from 'vitest';
import { cardRows, readPatientCard } from './patientCard';

const profile = {
  patientId: 'p1',
  phone: '+420 777 123 456',
  email: 'filip@example.cz',
  birthNumber: '9001011234',
  insuranceNumber: '9001011234',
  healthInsurerCode: '111',
  address: 'Dlouhá 1, Praha',
  notes: 'nic',
};

describe('the profile, as the card needs it', () => {
  it('reads contacts, identifiers, insurer and address', () => {
    expect(readPatientCard(profile)).toEqual({
      phone: '+420 777 123 456',
      email: 'filip@example.cz',
      birthNumber: '9001011234',
      insuranceNumber: '9001011234',
      insurerCode: '111',
      address: 'Dlouhá 1, Praha',
    });
  });

  it('treats a blank or absent value as not given', () => {
    expect(readPatientCard({ phone: '   ', email: null })).toEqual({
      phone: null,
      email: null,
      birthNumber: null,
      insuranceNumber: null,
      insurerCode: null,
      address: null,
    });
    expect(readPatientCard(undefined).phone).toBeNull();
  });
});

describe('the rows of the namesake card', () => {
  it('shows telephone, e-mail, insurance and birth number to who may see them', () => {
    expect(cardRows(readPatientCard(profile), true).map((r) => r.label)).toEqual([
      'Telefon',
      'E-mail',
      'Číslo pojištěnce',
      'Rodné číslo',
    ]);
  });

  it('leaves the two identifiers out entirely without the permission, even if sent', () => {
    const rows = cardRows(readPatientCard(profile), false);
    expect(rows.map((r) => r.label)).toEqual(['Telefon', 'E-mail']);
    expect(rows.some((r) => r.value === '9001011234')).toBe(false);
  });
});
