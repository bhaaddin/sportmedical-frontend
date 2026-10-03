import { describe, expect, it } from 'vitest';
import { fillText } from './fillText';

describe('fillText', () => {
  it('fills every occurrence of a placeholder', () => {
    expect(fillText('{a} a {a}', { a: 'x' })).toBe('x a x');
  });

  it('drops " na {email}" whole when there is no e-mail, so no dangling preposition is left', () => {
    expect(fillText('Odvolat můžete na {email}.', { email: '' })).toBe('Odvolat můžete.');
    expect(fillText('Odvolat můžete na {email}.', { email: 'a@b.cz' })).toBe('Odvolat můžete na a@b.cz.');
  });

  it('drops an empty "({service})" with its space', () => {
    expect(fillText('činnosti {activity} ({service}) a', { activity: 'X', service: '' })).toBe('činnosti X a');
    expect(fillText('činnosti {activity} ({service}) a', { activity: 'X', service: 'Y' })).toBe('činnosti X (Y) a');
  });

  it('leaves a text without placeholders alone, and does not interpret $ in a value', () => {
    expect(fillText('Bez zástupných znaků', { a: 'x' })).toBe('Bez zástupných znaků');
    expect(fillText('{a}', { a: '$& $1' })).toBe('$& $1');
  });
});
