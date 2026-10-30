import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { usePageTitle } from './usePageTitle';
import { useDocumentTitle } from '../components/shell/whereAmI';

function Public() { usePageTitle('Objednání'); return null; }
function Staff({ label }: { label: string }) { useDocumentTitle([{ label }]); return null; }

describe('browser tab titles', () => {
  it('names the page outside the staff shell', () => {
    render(<Public />);
    expect(document.title).toBe('Objednání · SportMedical');
  });
  it('never says SportMedical twice', () => {
    render(<Staff label="SportMedical" />);
    expect(document.title).toBe('SportMedical');
  });
});
