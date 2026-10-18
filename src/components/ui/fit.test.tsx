/*
 * The page fits the window (App's Layout region + components/ui/fit): at 390, 834 and 1440.
 *
 *   - the staff screens sit in ONE scroll region (`#fit-region`) under the line of place; the planner's stage does not
 *   - a table that asks to `fill` is a card with a sticky head and a scroll box of its own from 768, and a stack of
 *     cards on a phone (no sideways scroll)
 *   - a StackTable names every cell after its column, so the phone card says what each line is
 *   - FitPage / FitPanel take the height only from 768; a phone's page just flows
 *
 * What would have to break for these to fail: a page growing past the window again (no region), the planner losing its
 * own sizing, a phone drawing a table that scrolls sideways, or a stacked row losing its labels.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { buildTheme } from '../../theme';
import { ThemePrefsContext } from '../../themePrefs';

vi.mock('../../auth/accountRefresh', () => ({ useAccountRefresh: () => undefined }));
vi.mock('../booking/NewOrderChooser', () => {
  const NewOrderChooser = () => null;
  return { NewOrderChooser, default: NewOrderChooser };
});
vi.mock('../NotificationCenter', () => ({ default: () => null }));

const { Layout } = await import('../../StaffApp');
const { FitPage, FitBody, FitPanel } = await import('./fit');
const { StackTable } = await import('./StackTable');
const { ResponsiveDataList } = await import('./ResponsiveDataList');

const theme = buildTheme('#0D5C52', 'light');
const prefs = { accent: '#0D5C52', mode: 'light' as const, setAccent: () => undefined, setMode: () => undefined };

function inLayout(path: string, width: number) {
  setViewport(width);
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'settings.clinic.manage']));
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nováková', role: 'Recepce' }));
  return render(
    <ThemePrefsContext.Provider value={prefs}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[path]}>
          <Layout><p>obsah stránky</p></Layout>
        </MemoryRouter>
      </ThemeProvider>
    </ThemePrefsContext.Provider>,
  );
}

function plain(ui: React.ReactElement, width: number) {
  setViewport(width);
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

beforeEach(() => localStorage.clear());

describe('the fit region of the Layout', () => {
  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])('holds the page of a staff screen on a %s, inside <main>', (_name, width) => {
    inLayout('/prehled', width);
    const region = document.getElementById('fit-region');
    expect(region).not.toBeNull();
    expect(document.getElementById('main-content')?.contains(region)).toBe(true);
    expect(region?.contains(screen.getByText('obsah stránky'))).toBe(true);
    /* The region is the one thing that scrolls: it is positioned so nothing absolute escapes to the document. */
    expect(getComputedStyle(region as HTMLElement).position).toBe('relative');
    expect(getComputedStyle(region as HTMLElement).overflowY).toBe('auto');
  });

  it('leaves the planner stage its own sizing', () => {
    inLayout('/planovani', VIEWPORTS.desktop);
    expect(document.getElementById('fit-region')).toBeNull();
    expect(screen.getByText('obsah stránky')).toBeInTheDocument();
  });
});

describe('FitPage and FitPanel', () => {
  it('take the height that is left from 768 up, and only then', () => {
    const { unmount } = plain(<FitPage data-testid="page"><FitBody data-testid="body">x</FitBody></FitPage>, VIEWPORTS.desktop);
    expect(getComputedStyle(screen.getByTestId('page')).minHeight).toBe('0px');
    expect(getComputedStyle(screen.getByTestId('body')).display).toBe('flex');
    unmount();

    plain(<FitPage data-testid="page"><FitBody data-testid="body">x</FitBody></FitPage>, VIEWPORTS.phone);
    /* A phone's page flows: no flex-fill, no minimum of zero that would squash it. */
    expect(getComputedStyle(screen.getByTestId('page')).minHeight).not.toBe('0px');
    expect(getComputedStyle(screen.getByTestId('body')).display).not.toBe('flex');
  });

  it('give a panel a body that scrolls by itself on a tablet, and not on a phone', () => {
    const { unmount } = plain(<FitPanel head={<h2>Hlava</h2>}><p data-testid="inner">řádek</p></FitPanel>, VIEWPORTS.tablet);
    expect(getComputedStyle(screen.getByTestId('inner').parentElement as HTMLElement).overflowY).toBe('auto');
    unmount();

    plain(<FitPanel head={<h2>Hlava</h2>}><p data-testid="inner">řádek</p></FitPanel>, VIEWPORTS.phone);
    expect(getComputedStyle(screen.getByTestId('inner').parentElement as HTMLElement).overflowY).not.toBe('auto');
  });
});

describe('StackTable', () => {
  const table = (
    <StackTable>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Datum</TableCell>
            <TableCell>Důvod</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>1. 10.</TableCell>
            <TableCell>Servis</TableCell>
            <TableCell><button type="button">Uvolnit</button></TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={3}>Poznámka přes celý řádek</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </StackTable>
  );

  it('names every cell after its column - and leaves a headless or spanning cell without a label', () => {
    plain(table, VIEWPORTS.phone);
    expect(screen.getByText('1. 10.').getAttribute('data-label')).toBe('Datum');
    expect(screen.getByText('Servis').getAttribute('data-label')).toBe('Důvod');
    expect(screen.getByRole('button', { name: 'Uvolnit' }).closest('td')?.hasAttribute('data-label')).toBe(false);
    expect(screen.getByText('Poznámka přes celý řádek').hasAttribute('data-label')).toBe(false);
  });

  it('keeps every button and text it was given', () => {
    plain(table, VIEWPORTS.phone);
    expect(screen.getByRole('button', { name: 'Uvolnit' })).toBeInTheDocument();
    expect(screen.getByText('Servis')).toBeInTheDocument();
  });
});

describe('ResponsiveDataList fill', () => {
  const rows = [{ id: '1', name: 'Petra' }];
  const list = (
    <ResponsiveDataList
      rows={rows}
      rowKey={(r) => r.id}
      columns={[{ key: 'name', header: 'Jméno', cell: (r) => r.name }]}
      renderCard={(r) => <span>{r.name}</span>}
      ariaLabel="Lidé"
      fill
    />
  );

  it('is a scroll box with a sticky head on a desktop and a tablet', () => {
    for (const width of [VIEWPORTS.desktop, VIEWPORTS.tablet]) {
      const { container, unmount } = plain(list, width);
      const scroller = container.querySelector('.MuiTableContainer-root') as HTMLElement;
      expect(getComputedStyle(scroller).overflow).toBe('auto');
      expect(container.querySelector('.MuiTable-stickyHeader, table.MuiTable-stickyHeader')).not.toBeNull();
      unmount();
    }
  });

  it('is a stack of cards on a phone - no table, nothing to scroll sideways', () => {
    const { container } = plain(list, VIEWPORTS.phone);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
  });

  it('keeps all columns on a landscape tablet (1024) and three on a portrait one', () => {
    const wide = [
      { key: 'a', header: 'A', cell: () => 'a', tablet: true },
      { key: 'b', header: 'B', cell: () => 'b' },
      { key: 'c', header: 'C', cell: () => 'c' },
      { key: 'd', header: 'D', cell: () => 'd', tablet: true },
      { key: 'e', header: 'E', cell: () => 'e', tablet: true },
    ];
    const make = () => (
      <ResponsiveDataList rows={rows} rowKey={(r) => r.id} columns={wide} renderCard={() => null} ariaLabel="Sloupce" />
    );
    setViewport(834);
    const portrait = render(<ThemeProvider theme={theme}>{make()}</ThemeProvider>);
    expect(portrait.container.querySelectorAll('th')).toHaveLength(3);
    portrait.unmount();

    setViewport(1024, 768);
    const landscape = render(<ThemeProvider theme={theme}>{make()}</ThemeProvider>);
    expect(landscape.container.querySelectorAll('th')).toHaveLength(5);
  });
});
