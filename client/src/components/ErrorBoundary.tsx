import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";
import { AppShell, Button, Panel } from '../design-system';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppShell className="flex items-center justify-center p-8">
          <Panel className="flex w-full max-w-2xl flex-col items-center p-8 text-center">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="ui-panel ui-panel--inset mb-6 w-full overflow-auto p-4 text-left">
              <pre className="whitespace-break-spaces text-sm text-[var(--ui-text-muted)]">
                {this.state.error?.stack}
              </pre>
            </div>

            <Button intent="secondary"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={16} />
              Reload Page
            </Button>
          </Panel>
        </AppShell>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
