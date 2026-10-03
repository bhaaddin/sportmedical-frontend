import { describe, it, expect } from 'vitest';
import { readApiProblem } from './apiProblem';

describe('what a refusal carries', () => {
  it('reads field errors, a list of them, and a plain message', () => {
    expect(readApiProblem({ response: { data: { errors: { WeightKg: ['Moc málo.', 'x'] } } } })).toEqual({ fields: { WeightKg: 'Moc málo.' } });
    expect(readApiProblem({ response: { data: { errors: [{ propertyName: 'Device', errorMessage: 'Dlouhé.' }] } } }).fields).toEqual({ Device: 'Dlouhé.' });
    expect(readApiProblem({ response: { data: { message: 'Pacient nenalezen.' } } })).toEqual({ message: 'Pacient nenalezen.', fields: {} });
    expect(readApiProblem({ response: { data: 'oops' } })).toEqual({ fields: {} });
    expect(readApiProblem(undefined)).toEqual({ fields: {} });
  });
});
