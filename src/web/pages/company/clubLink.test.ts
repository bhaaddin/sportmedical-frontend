import { describe, expect, it } from 'vitest';
import { clubLinkTarget, extractClubToken } from './clubLink';

describe('the link a club sends to its athletes', () => {
  it.each([
    ['https://app.sportmedical.example/klub/abc123XYZ', '/klub/abc123XYZ'],
    ['  https://app.sportmedical.example/klub/abc123XYZ  ', '/klub/abc123XYZ'],
    ['https://app.sportmedical.example/klub/abc123XYZ?utm_source=mail#x', '/klub/abc123XYZ'],
    ['https://app.sportmedical.example/klub/abc123XYZ/', '/klub/abc123XYZ'],
    ['http://localhost:3000/klub/tok-en_1.2~3', '/klub/tok-en_1.2~3'],
    ['app.sportmedical.example/klub/abc123XYZ', '/klub/abc123XYZ'],
    ['/klub/abc123XYZ', '/klub/abc123XYZ'],
    ['klub/abc123XYZ', '/klub/abc123XYZ'],
    ['https://app.sportmedical.example/KLUB/abc123XYZ', '/klub/abc123XYZ'],
  ])('a link %s opens %s', (input, target) => {
    expect(clubLinkTarget(input)).toBe(target);
  });

  it.each([
    ['abc123XYZ', '/klub/abc123XYZ'],
    ['  abc123XYZ \n', '/klub/abc123XYZ'],
    ['3f2b7c9e-1a44-4d0e-9a52-8b0c6f5d7e21', '/klub/3f2b7c9e-1a44-4d0e-9a52-8b0c6f5d7e21'],
  ])('a bare token %s opens %s', (input, target) => {
    expect(clubLinkTarget(input)).toBe(target);
  });

  it('only ever points at this site: the host of a pasted link is dropped, the token kept', () => {
    expect(clubLinkTarget('https://evil.example/klub/abc123XYZ')).toBe('/klub/abc123XYZ');
    expect(clubLinkTarget('https://evil.example/login')).toBeNull();
  });

  it.each([[''], ['   '], ['ne ten odkaz'], ['abc'], ['https://example.cz/'], ['https://example.cz/klub/'], ['<script>alert(1)</script>'], ['javascript:alert(1)']])(
    'refuses %j',
    (input) => {
      expect(clubLinkTarget(input)).toBeNull();
    },
  );

  it('decodes an escaped token once and encodes it again for the path', () => {
    expect(extractClubToken('https://a.cz/klub/a%2Db%2Dc%2Dd')).toBe('a-b-c-d');
    expect(clubLinkTarget('https://a.cz/klub/a%2Db%2Dc%2Dd')).toBe('/klub/a-b-c-d');
    expect(extractClubToken('https://a.cz/klub/%E0%A4%A')).toBeNull();
  });
});
