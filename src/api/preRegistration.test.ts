import { describe, expect, it } from 'vitest';
import { shareableLink } from './preRegistration';

describe('the link the desk pastes into a message', () => {
  it('is the server\'s absolute address when the public site is configured', () => {
    expect(shareableLink({ url: 'https://klinika.cz/dokonceni/abc', path: '/dokonceni/abc' }, 'http://localhost:5173'))
      .toBe('https://klinika.cz/dokonceni/abc');
  });

  it('falls back to this site\'s origin plus the path, never a bare path', () => {
    expect(shareableLink({ url: null, path: '/dokonceni/abc' }, 'http://localhost:5173/'))
      .toBe('http://localhost:5173/dokonceni/abc');
    expect(shareableLink({ url: '', path: '/dokonceni/abc' }, 'https://demo.example'))
      .toBe('https://demo.example/dokonceni/abc');
  });
});
