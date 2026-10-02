/*
 * The questionnaire the patient fills in comes from the server now, and this
 * file is the seam where the server's rows become the shapes the dialog draws.
 *
 * ── Why it is tested rather than trusted ──
 *
 * The dialog has always worked off closures: an item carries `when(answers)`
 * and a section carries `when({ female })`. The server cannot send a function,
 * so it sends the key that has to be answered yes and a flag for the women's
 * section, and this file builds the closures back. If it builds them wrongly
 * nothing fails loudly — a follow-up box quietly never opens, or a gynaecology
 * section is put in front of a man. Both look like the form working.
 *
 * What would have to break for these to fail: reading `showWhenAnswered` as a
 * truthy check instead of an equality one (an answer of "ne" would open the
 * box), forgetting that a notice carries its sentence in the label, dropping
 * the placeholder or the note, or giving two sections the same React key.
 *
 * And one more, since 23. 9. 2026: that the form asks for the questionnaire
 * of the BOOKED činnost, by its hold token, and not for a key written into
 * the bundle — and that the token travels in the body, never in the URL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('axios', () => {
  const create = () => ({
    post,
    interceptors: { response: { use: vi.fn() }, request: { use: vi.fn() } },
  });
  return { default: { create, isAxiosError: () => false }, isAxiosError: () => false };
});

const { loadQuestionnaire } = await import('./publicQuestionnaire');
import { sectionsFor } from '../services/publicIntake/healthQuestionnaire';

/** One question as the server sends it, with everything optional absent. */
const question = (over: Record<string, unknown> = {}) => ({
  key: 'kardio_bolest',
  kind: 'yesno',
  label: 'Bolest na hrudi při zátěži?',
  help: null,
  placeholder: null,
  options: [],
  minimum: null,
  maximum: null,
  showWhenAnswered: null,
  ...over,
});

const section = (over: Record<string, unknown> = {}) => ({
  number: '9',
  title: 'Kardiovaskulární onemocnění',
  note: null,
  femaleOnly: false,
  questions: [question()],
  ...over,
});

const served = (sections: unknown[]) => {
  post.mockResolvedValue({
    data: {
      definitionKey: 'dotaznik-pro-plavce',
      schemaVersion: 3,
      name: 'Dotazník pro plavce',
      sections,
    },
  });
};

beforeEach(() => {
  post.mockReset();
});

describe('which questionnaire is asked for', () => {
  it('asks for the one the booked činnost names, by the hold token, in the body and never the URL', async () => {
    served([section()]);

    await loadQuestionnaire('hold-1');

    expect(post).toHaveBeenCalledWith('/api/public/questionnaire/for-booking', { holdToken: 'hold-1' });
  });

  it('asks for the clinic default for somebody who came without booking', async () => {
    served([section()]);

    await loadQuestionnaire(null);

    expect(post).toHaveBeenCalledWith('/api/public/questionnaire/for-booking', { holdToken: null });
  });

  it('carries the key, the version and the name back — an answer has to name what it answered', async () => {
    served([section()]);

    const loaded = await loadQuestionnaire('hold-1');

    expect(loaded.definitionKey).toBe('dotaznik-pro-plavce');
    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.name).toBe('Dotazník pro plavce');
  });
});

describe('what the server sends becomes what the dialog draws', () => {
  it('keeps the section note, which is the only place the clinic explains itself', async () => {
    served([section({ note: 'Zbytek osobních údajů už máme z registrace výše.' })]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.note).toBe('Zbytek osobních údajů už máme z registrace výše.');
  });

  it('gives two sections different keys even when the clinic numbers them the same', async () => {
    served([section({ number: '4' }), section({ number: '4' })]);

    const [a, b] = (await loadQuestionnaire(null)).sections;

    expect(a.id).not.toBe(b.id);
  });
});

describe('the follow-up box', () => {
  const withFollowUp = () =>
    section({
      questions: [
        question(),
        question({
          key: 'kardio_bolest_detail',
          kind: 'longtext',
          showWhenAnswered: 'kardio_bolest',
        }),
      ],
    });

  it('opens on a yes', async () => {
    served([withFollowUp()]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[1].when?.({ kardio_bolest: true })).toBe(true);
  });

  it('stays shut on a no, and on an answer that is merely present', async () => {
    served([withFollowUp()]);

    const [first] = (await loadQuestionnaire(null)).sections;
    const shown = first.items[1].when;

    expect(shown?.({ kardio_bolest: false })).toBe(false);
    expect(shown?.({ kardio_bolest: 'ne' })).toBe(false);
    expect(shown?.({})).toBe(false);
  });

  it('is absent on a question that is always on screen', async () => {
    served([section()]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[0].when).toBeUndefined();
  });
});

describe('the women-only section', () => {
  it('is put to a woman and withheld from a man', async () => {
    served([section({ number: '7', title: 'Gynekologická anamnéza', femaleOnly: true })]);

    const { sections } = await loadQuestionnaire(null);

    expect(sectionsFor(sections, true)).toHaveLength(1);
    expect(sectionsFor(sections, false)).toHaveLength(0);
  });

  it('leaves every other section to both', async () => {
    served([section()]);

    const { sections } = await loadQuestionnaire(null);

    expect(sectionsFor(sections, false)).toHaveLength(1);
  });
});

describe('the kinds the form draws', () => {
  it('draws a notice with the sentence, not with a label and an empty box', async () => {
    served([
      section({
        questions: [
          question({ key: 'uvod', kind: 'notice', label: 'Následující otázky se týkají rodiny.' }),
        ],
      }),
    ]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[0].field).toEqual({
      kind: 'notice',
      id: 'uvod',
      text: 'Následující otázky se týkají rodiny.',
    });
  });

  it('keeps a number question inside the bounds the clinic set', async () => {
    served([
      section({
        questions: [question({ key: 'vyska', kind: 'number', minimum: 100, maximum: 250 })],
      }),
    ]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[0].field).toMatchObject({ kind: 'number', min: 100, max: 250 });
  });

  it('keeps the choices in the order the clinic wrote them', async () => {
    served([
      section({
        questions: [
          question({
            key: 'cukrovka',
            kind: 'choice',
            options: ['Ne', 'Ano – 1. typu', 'Ano – 2. typu'],
          }),
        ],
      }),
    ]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[0].field).toMatchObject({
      kind: 'choice',
      options: ['Ne', 'Ano – 1. typu', 'Ano – 2. typu'],
    });
  });

  it('keeps the placeholder on a line of text', async () => {
    served([
      section({
        questions: [question({ key: 'lekar', kind: 'text', placeholder: 'Jméno a adresa' })],
      }),
    ]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[0].field).toMatchObject({ kind: 'text', placeholder: 'Jméno a adresa' });
  });

  it('falls back to a line of text for a kind this form has no drawing for', async () => {
    served([section({ questions: [question({ key: 'datum', kind: 'date' })] })]);

    const [first] = (await loadQuestionnaire(null)).sections;

    expect(first.items[0].field.kind).toBe('text');
  });
});
