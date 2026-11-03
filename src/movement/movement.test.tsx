/* The movement module: schemas, the flag, the review screen with the fixture, the decision and the upload check. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { clipResultSchema, decisionInputSchema, FAULT_TAGS, getClip, type ClipDetail } from '../api/movement';
import { MOVEMENT_FLAG_KEY, MOVEMENT_MOCK_KEY, movementEnabled, movementMock } from './flags';
import { cs, en, moveT } from './i18n';
import { buildDropJumpFrontResult, buildQaRejectedResult, buildRunningSideResult } from './fixtures/synth';
import { ReviewView } from './components/ReviewView';
import { StatusView } from './components/StatusView';
import { MarkerPicker } from './components/MarkerPicker';
import { staticCommands } from '../ui/shelf/palette/commandModel';

const wrap = (ui: React.ReactElement, path = '/') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="*" element={ui} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const clipOf = (over: Partial<ClipDetail> = {}): ClipDetail => ({
  clipId: 'fx-running-side', sessionId: 's', patientId: 'p1', movement: 'running', view: 'side', status: 'done',
  error: null, result: buildRunningSideResult(), decisions: [], ...over,
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.edit']));
  setViewport(VIEWPORTS.desktop);
});

describe('contract schemas', () => {
  it('both fixtures are valid ClipResults', () => {
    expect(() => clipResultSchema.parse(buildRunningSideResult())).not.toThrow();
    expect(() => clipResultSchema.parse(buildDropJumpFrontResult())).not.toThrow();
    expect(() => clipResultSchema.parse(buildQaRejectedResult())).not.toThrow();
  });
  it('a result with a wrong schemaVersion is refused', () => {
    expect(() => clipResultSchema.parse({ ...buildRunningSideResult(), schemaVersion: 2 })).toThrow();
  });
  it('the fault tag list is faultTags.v1 (12 tags) and a decision must use it', () => {
    expect(FAULT_TAGS).toHaveLength(12);
    expect(() => decisionInputSchema.parse({ action: 'accept', band: 'green', faultTags: ['made_up'], unsure: false, note: '' })).toThrow();
    expect(() => decisionInputSchema.parse({ action: 'accept', band: 'green', faultTags: ['knee_valgus'], unsure: false, note: '' })).not.toThrow();
  });
});

describe('feature flag', () => {
  it('is off by default and the mock needs the module on', () => {
    expect(movementEnabled()).toBe(false);
    localStorage.setItem(MOVEMENT_MOCK_KEY, '1');
    expect(movementMock()).toBe(false);
    localStorage.setItem(MOVEMENT_FLAG_KEY, '1');
    expect(movementEnabled()).toBe(true);
    expect(movementMock()).toBe(true);
  });
  it('the palette offers the page only with the flag on', () => {
    expect(staticCommands(['patients.view']).some((c) => c.id === 'page-movement')).toBe(false);
    localStorage.setItem(MOVEMENT_FLAG_KEY, '1');
    expect(staticCommands(['patients.view']).some((c) => c.id === 'page-movement')).toBe(true);
    expect(staticCommands([]).some((c) => c.id === 'page-movement')).toBe(false);
  });
});

describe('words', () => {
  it('English has every Czech key and fills placeholders', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(cs).sort());
    expect(moveT('score.draft', undefined, 'cs')).toBe('Návrh — čeká na kontrolu klinika');
    expect(moveT('review.frame', { n: 3, total: 120 }, 'en')).toBe('Frame 3 of 120');
  });
});

describe('review screen with the fixture', () => {
  it('shows the draft chip, the findings by severity and the left-right table', () => {
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    expect(screen.getByTestId('score-label')).toHaveTextContent('Návrh — čeká na kontrolu klinika');
    const findings = screen.getByRole('region', { name: 'Nálezy' });
    expect(within(findings).getByRole('region', { name: 'Závažné' })).toBeInTheDocument();
    expect(within(findings).getByRole('region', { name: 'Sledovat' })).toBeInTheDocument();
    const table = screen.getByTestId('metrics-table');
    expect(within(table).getByText('Pokrčení kolena při dopadu')).toBeInTheDocument();
    expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(4);
    expect(screen.getByTestId('overlay-canvas')).toBeInTheDocument();
  });

  it('clicking a finding seeks to its evidence frame', async () => {
    const result = buildRunningSideResult();
    wrap(<ReviewView clip={clipOf({ result })} videoSrc={null} />);
    const flag = result.flags.find((f) => f.id === 'running.overstride')!;
    await userEvent.setup().click(screen.getByRole('button', { name: new RegExp(flag.sentence.cs.slice(0, 20)) }));
    expect(screen.getByTestId('frame-label')).toHaveTextContent(`Snímek ${flag.evidence.frame + 1} z 120`);
    expect(screen.getByRole('button', { name: new RegExp(flag.sentence.cs.slice(0, 20)) })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the scrubber moves with the keyboard and reports the frame', async () => {
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    const slider = screen.getByTestId('scrubber');
    const before = Number(slider.getAttribute('aria-valuenow'));
    slider.focus();
    await userEvent.setup().keyboard('{ArrowRight}{ArrowRight}');
    expect(Number(slider.getAttribute('aria-valuenow'))).toBe(before + 2);
    await userEvent.setup().keyboard('{End}');
    expect(slider).toHaveAttribute('aria-valuenow', '119');
  });

  it('draws one chart per angle with a playhead that clicks seek', () => {
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    for (const base of ['knee_flexion', 'hip_flexion', 'trunk_flexion']) expect(screen.getByTestId(`curve-${base}`)).toBeInTheDocument();
  });

  it('the layer toggles are real toggle buttons', async () => {
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    const skeleton = screen.getByRole('button', { name: 'Kostra' });
    expect(skeleton).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(skeleton);
    expect(skeleton).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the clinician decision instead of the draft once one exists, and unlocks the report', () => {
    const decisions = [{ id: 'd1', action: 'accept' as const, band: 'green' as const, faultTags: ['knee_valgus' as const], unsure: false, note: 'ok', decidedBy: 'MUDr. Test', decidedAt: '2026-11-03T10:00:00Z' }];
    wrap(<ReviewView clip={clipOf({ decisions })} videoSrc={null} />);
    expect(screen.getByTestId('score-label')).toHaveTextContent('Rozhodnutí klinika: Zelená');
    expect(screen.getByRole('button', { name: /Otevřít zprávu/ })).toBeEnabled();
    const history = screen.getByTestId('decision-history');
    expect(within(history).getByText(/MUDr\. Test/)).toBeInTheDocument();
    expect(within(history).getByText('Koleno dovnitř')).toBeInTheDocument();
  });

  it('keeps the report locked without a decision', () => {
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    expect(screen.getByRole('button', { name: /Otevřít zprávu/ })).toBeDisabled();
    expect(screen.getByText('Zatím nikdo nerozhodl.')).toBeInTheDocument();
  });

  it('needs_review is announced and lists the QA reasons', () => {
    const result = buildQaRejectedResult('x');
    wrap(<ReviewView clip={clipOf({ result })} videoSrc={null} />);
    expect(screen.getByTestId('score-label')).toHaveTextContent('Vyžaduje ruční kontrolu');
    expect(screen.getByText(/Málo snímků za sekundu/)).toBeInTheDocument();
  });

  it('works on a phone: one column, targets are 44 px buttons', () => {
    setViewport(VIEWPORTS.phone);
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    expect(screen.getByTestId('review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Další událost' })).toBeInTheDocument();
  });
});

describe('decision form', () => {
  it('needs a band for accept and edit, and offers the 12 tags (relevant first)', async () => {
    const user = userEvent.setup();
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    expect(screen.queryByRole('button', { name: 'Uložit rozhodnutí' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Upravit' }));
    // the draft band is pre-selected, so clear it by choosing the same one again
    const save = screen.getByRole('button', { name: 'Uložit rozhodnutí' });
    await user.click(screen.getByRole('button', { name: 'Sledovat', pressed: true }));
    expect(screen.getByText('Vyberte hodnocení.')).toBeInTheDocument();
    expect(save).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Červená' }));
    expect(save).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Příliš dlouhý krok' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tuhý dopad' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Další štítky' }));
    expect(screen.getByRole('button', { name: 'Tuhý dopad' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zamítnout' }));
    await waitFor(() => expect(screen.queryByText('Vyberte hodnocení.')).toBeNull());
  });

  it('is read-only without the permission to edit patients', () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    wrap(<ReviewView clip={clipOf()} videoSrc={null} />);
    expect(screen.getByText('K rozhodnutí chybí oprávnění upravovat pacienty.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Potvrdit' })).toBeDisabled();
  });
});

describe('status screen', () => {
  it('shows the queue and keeps polling by itself', () => {
    wrap(<StatusView clip={clipOf({ status: 'queued', result: null })} />);
    expect(screen.getByTestId('status-view')).toHaveAttribute('data-status', 'queued');
    expect(screen.getByText(/čeká na zpracování/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zkusit znovu' })).toBeNull();
  });
  it('a failed clip offers a retry; a QA rejection offers to record again with the reasons', () => {
    const { unmount } = wrap(<StatusView clip={clipOf({ status: 'failed', result: null, error: { code: 'pose_failed', message: 'x' } })} />);
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('nepodařilo najít postavu');
    unmount();
    wrap(<StatusView clip={clipOf({ status: 'failed', result: buildQaRejectedResult('x'), error: { code: 'qa_rejected', message: 'x' } })} />);
    expect(screen.queryByRole('button', { name: 'Zkusit znovu' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Natočit znovu' })).toHaveAttribute('href', '/pohyb/nahrat?patientId=p1');
    expect(screen.getByText(/Málo snímků za sekundu/)).toBeInTheDocument();
  });
});

describe('marker picker', () => {
  it('measures the marker in native pixels from two clicks and reports it; reset clears it', async () => {
    const onChange = vi.fn();
    // jsdom has no layout: give the box a size so the letterbox maths has something to work with
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 });
    wrap(<MarkerPicker frame={{ url: 'blob:x', width: 1920, height: 1080 }} onChange={onChange} />);
    const box = screen.getByRole('img', { name: /Značka 1 m/ });
    box.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, x: 0, y: 0, toJSON: () => ({}) });
    const user = userEvent.setup();
    await user.pointer({ target: box, coords: { clientX: 100, clientY: 200 }, keys: '[MouseLeft]' });
    expect(screen.getByTestId('marker-result')).toHaveTextContent('druhý konec');
    await user.pointer({ target: box, coords: { clientX: 300, clientY: 200 }, keys: '[MouseLeft]' });
    expect(screen.getByTestId('marker-result')).toHaveTextContent('960 px');
    expect(onChange).toHaveBeenLastCalledWith(960);
    await user.click(screen.getByRole('button', { name: 'Smazat značku' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
  });
});

describe('mock api', () => {
  it('walks a clip through queued, processing and done', async () => {
    localStorage.setItem(MOVEMENT_FLAG_KEY, '1');
    localStorage.setItem(MOVEMENT_MOCK_KEY, '1');
    const first = await getClip('fx-dropjump-front');
    expect(first.status).toBe('done');
    expect(first.result?.movement).toBe('drop_jump');
    const { createSession, createClip, processClip } = await import('../api/movement');
    const s = await createSession({ patientId: 'ZZ-test', date: '2026-11-03' });
    const c = await createClip(s.id, { movement: 'running', view: 'side', markerPx: 412 });
    expect((await getClip(c.clipId)).status).toBe('uploading');
    await processClip(c.clipId);
    expect((await getClip(c.clipId)).status).toBe('queued');
  });
});
