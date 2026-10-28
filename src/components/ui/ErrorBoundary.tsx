import { Component, type ComponentChildren } from 'preact';
import { withBase } from '@/lib/url';

interface Props {
  children: ComponentChildren;
  /** Name shown in the fallback. */
  area?: string;
}
interface State {
  error: Error | null;
}

/** Keeps one broken island from blanking the page; offers reload and a safe way out. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };
  static override getDerivedStateFromError(error: Error): State {
    return { error };
  }
  override componentDidCatch(error: Error): void {
    console.error('[ethereal]', error);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div class="surface p-6" role="alert">
        <h2 class="font-display text-2xl">
          Something went wrong{this.props.area ? ` in ${this.props.area}` : ''}.
        </h2>
        <p class="text-muted mt-2 text-sm">
          Your data is safe on this device. Reloading usually fixes it. If it keeps happening,
          export a backup from settings and send the message below.
        </p>
        <pre class="bg-muted mt-3 max-h-24 overflow-auto rounded-xl p-3 text-xs">
          {String(this.state.error?.message ?? this.state.error)}
        </pre>
        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary text-sm" onClick={() => location.reload()}>
            Reload
          </button>
          <a href={withBase('/settings/')} class="btn btn-secondary text-sm">
            Settings &amp; backup
          </a>
        </div>
      </div>
    );
  }
}

/** Convenience wrapper so pages can do `<Guarded area="Today"><TodayScreen/></Guarded>`. */
export function Guarded({ area, children }: Props) {
  return <ErrorBoundary {...(area ? { area } : {})}>{children}</ErrorBoundary>;
}
