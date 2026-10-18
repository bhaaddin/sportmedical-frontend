import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { StaffShellPlaceholder } from './PageLoader';

function at(path: string) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={[path]}>
        <StaffShellPlaceholder />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('StaffShellPlaceholder (shown while the staff portal arrives)', () => {
  it('draws the frame of the navigation and the spinner on an ordinary staff screen', () => {
    at('/prehled');
    expect(screen.getByTestId('staff-shell-placeholder')).toBeInTheDocument();
    expect(screen.getByText('SPORTMEDICAL')).toBeInTheDocument();
  });

  it('draws no frame on the planner routes, where the real shell draws no sidebar either', () => {
    at('/planovani');
    expect(screen.queryByTestId('staff-shell-placeholder')).toBeNull();
    expect(screen.getByText('SPORTMEDICAL')).toBeInTheDocument();
  });

  it('draws no frame on a club\'s own screen', () => {
    at('/clubs/942e2676-d730-4a13-8016-17f95abd26e2');
    expect(screen.queryByTestId('staff-shell-placeholder')).toBeNull();
  });

  it('keeps the frame for the clubs list and its section pages', () => {
    at('/clubs');
    expect(screen.getByTestId('staff-shell-placeholder')).toBeInTheDocument();
  });
});
