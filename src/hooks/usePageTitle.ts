import { useEffect } from 'react';

/** The browser tab of a page outside the staff shell: "Objednání · SportMedical". */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · SportMedical`;
  }, [title]);
}
