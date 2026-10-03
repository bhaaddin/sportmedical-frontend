/* Never a white screen: when a public page throws while rendering, the visitor sees what failed
   and a "Zkusit znovu" button, with the header and footer still around it. The boundary is reset
   by navigating elsewhere (`resetKey` = the path). */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { PageHero } from './ui';

interface Props { children: ReactNode; resetKey: string }
interface State { failed: boolean; key: string }

export class WebErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // A navigation to another page clears the failure.
    return props.resetKey !== state.key ? { failed: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Not a page the visitor can fix; leave a trace for whoever opens the console.
    console.error('[web] page failed to render:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <PageHero eyebrow="Něco se nepovedlo" title="Stránku se nepodařilo zobrazit" lead="Zkuste to prosím znovu. Pokud potíže přetrvají, zavolejte nám — telefon najdete dole na stránce.">
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          style={{
            alignSelf: 'flex-start', minHeight: 54, padding: '0 28px', borderRadius: 27, border: 0, cursor: 'pointer',
            background: '#F0912E', color: '#1A1206', fontWeight: 700, fontSize: 16,
          }}
        >
          Zkusit znovu
        </button>
      </PageHero>
    );
  }
}
