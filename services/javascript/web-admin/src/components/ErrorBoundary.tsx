import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught client runtime exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">Application Exception Intercepted</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              An unexpected render fault occurred in this view. The application state was safely isolated to protect transit session integrity.
            </p>

            {this.state.error && (
              <div className="mt-4 p-3 bg-slate-950/80 border border-slate-700/60 rounded-xl text-left font-mono text-[11px] text-rose-300 max-h-28 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-700 text-slate-300 hover:bg-slate-700/60 rounded-xl text-xs font-semibold transition-all"
              >
                <Home className="w-4 h-4" />
                Safe Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
