import { onDark } from '@/constants/design';
import React, { Component, ReactNode } from 'react';
import ScreenError from '@/components/ScreenError';
import { log } from '@/features/diagnostics/log';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The last line: a crash no route boundary caught (`RouteErrorBoundary`) —
 * the providers, the player host, the root stack itself. Fixed dark colours,
 * because the theme may be what failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  /**
   * The component stack is the point.
   *
   * This went to `console.error` and therefore nowhere, which is how #325 —
   * a context consumer mounted outside its provider — reached three users'
   * phones with the name of the missing provider sitting in `componentStack`
   * on each of them. Logged, it survives the restart that follows and leaves
   * with the diagnostics export.
   */
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    log.crash.error('uncaught render error', {
      name: error.name,
      // `message` rather than the Error: a record holds primitives, and the
      // stack worth having here is the component one, not the JS one.
      detail: error.message,
      componentStack: info.componentStack ?? undefined,
      boundary: 'root',
    });
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ScreenError
        error={this.state.error}
        retry={this.retry}
        palette={{
          background: onDark.background,
          text: onDark.text,
          subtext: onDark.subtext,
          surface: onDark.surfaceElevated,
          border: onDark.border,
        }}
      />
    );
  }
}
