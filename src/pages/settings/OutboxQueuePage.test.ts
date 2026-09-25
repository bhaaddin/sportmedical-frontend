/*
 * The queue screen shows the message as sentences, not as markup: the body
 * is the server's own generated HTML, and the owner reads it to know what a
 * patient would get.
 */
import { describe, it, expect } from 'vitest';
import { bodyAsText } from './OutboxQueuePage';
import { exampleUntil } from './BookingChangesPage';
import { templateLabel } from '../../api/systemOutbox';

describe('bodyAsText', () => {
  it('turns paragraphs into lines and keeps the link target readable', () => {
    const text = bodyAsText(
      '<p>Dobrý den,</p><p>váš termín je <strong>čtvrtek 24. 9. 2026 v 9:00</strong>.</p>'
      + '<p><a href="https://klinika.test/rezervace/tok">Zobrazit rezervaci</a> — najdete tam soubor.</p>',
    );
    expect(text).toBe(
      'Dobrý den,\nváš termín je čtvrtek 24. 9. 2026 v 9:00.\n'
      + 'Zobrazit rezervaci (https://klinika.test/rezervace/tok) — najdete tam soubor.',
    );
  });

  it('decodes what the server escaped, so a name reads as typed', () => {
    expect(bodyAsText('<p>Zavolejte na &#x2B;420 777 &amp; &lt;b&gt;</p>')).toBe('Zavolejte na +420 777 & <b>');
  });
});

describe('templateLabel', () => {
  it('names the known messages in Czech and shows an unknown code as it is', () => {
    expect(templateLabel('booking-rescheduled')).toBe('Přesun termínu pacientovi');
    expect(templateLabel('intake-link')).toBe('Odkaz k dokončení registrace');
    expect(templateLabel('something-else')).toBe('something-else');
    expect(templateLabel(null)).toBe('Zpráva');
  });
});

describe('exampleUntil', () => {
  it('works the example from the fixed Thursday nine o’clock', () => {
    expect(exampleUntil(24)).toMatch(/^ve? středa 9:00$/);
    expect(exampleUntil(72)).toMatch(/^v pondělí 9:00$/);
    expect(exampleUntil(1)).toMatch(/^ve? čtvrtek 8:00$/);
  });
});
