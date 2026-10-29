import { describe, expect, it } from 'vitest';
import { fromEditorHtml, fromEditorText, placeholderLabel, textToEditorHtml, toEditorHtml } from './richText';

const PLACEHOLDERS = [
  { key: 'pacient.jmeno', description: 'Křestní jméno pacienta.' },
  { key: 'vlastni.neco', description: 'Něco krátkého.' },
];

describe('richText', () => {
  it('shows placeholders as labelled chips and turns them back into {{key}}', () => {
    const stored = '<p>Dobrý den, {{pacient.jmeno}}!</p><p><a href="{{odkaz.sprava}}">Rezervace</a></p>';
    const shown = toEditorHtml(stored, PLACEHOLDERS);

    expect(shown).toContain('data-ph="pacient.jmeno"');
    expect(shown).toContain('>Jméno<');
    expect(shown).not.toContain('{{pacient.jmeno}}');
    expect(fromEditorHtml(shown)).toBe(stored);
  });

  it('drops anything that could run', () => {
    const shown = toEditorHtml('<p onclick="x()">Ahoj<script>alert(1)</script><a href="javascript:alert(1)">a</a></p>', []);
    expect(shown).not.toMatch(/onclick|script|javascript/i);
    expect(shown).toContain('Ahoj');
  });

  it('keeps the subject as plain text', () => {
    const shown = textToEditorHtml('Termín <b> {{pacient.jmeno}}', PLACEHOLDERS);
    expect(fromEditorText(shown)).toBe('Termín <b> {{pacient.jmeno}}');
  });

  it('labels unknown placeholders from their description', () => {
    expect(placeholderLabel('vlastni.neco', 'Něco krátkého.')).toBe('Něco krátkého');
    expect(placeholderLabel('x.dlouhy_nazev', 'Tohle je velmi dlouhý popis který se do štítku nevejde vůbec')).toBe('dlouhy nazev');
  });

  it('treats an emptied editor as empty', () => {
    expect(fromEditorHtml('<p><br></p>')).toBe('');
  });
});
