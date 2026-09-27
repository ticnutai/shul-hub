import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

/**
 * A deploy replaced the app's files while this page was open: a lazy page
 * then fails with "Failed to fetch dynamically imported module". Not a bug -
 * the newer version is on the server, so the page reloads into it by itself
 * (at most once every 30 seconds, so a real outage cannot loop it).
 */
const STALE_CHUNK = /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i;
const RELOAD_KEY = "app-boundary-chunk-reload";

export function isStaleChunkError(error: Error | null | undefined): boolean {
  return Boolean(error && STALE_CHUNK.test(String(error.message ?? error)));
}

function reloadOnceForNewVersion(): boolean {
  try {
    if (navigator.onLine === false) return false;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // No storage: still reload once; the check above only prevents loops.
  }
  window.setTimeout(() => window.location.reload(), 600);
  return true;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** A newer version was published; the page is reloading into it. */
  updating?: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    if (isStaleChunkError(error)) this.setState({ updating: reloadOnceForNewVersion() });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.updating) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 gap-3 text-center" dir="rtl" role="status">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-semibold">מתעדכן לגרסה החדשה…</p>
        </div>
      );
    }
    if (this.state.hasError) {
      const stale = isStaleChunkError(this.state.error);
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 gap-4 text-center" dir="rtl">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">
            {this.props.fallbackTitle || "משהו השתבש"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {stale
              ? "יצאה גרסה חדשה של האתר בזמן שהדף היה פתוח. לחצו \"רענן את הדף\" כדי לעבור אליה."
              : "אירעה שגיאה בלתי צפויה. נסה לרענן את הדף או לחזור אחורה."}
          </p>
          {this.state.error && (
            <details className="text-xs text-muted-foreground max-w-md">
              <summary className="cursor-pointer">פרטים טכניים</summary>
              <pre className="mt-2 p-2 bg-muted rounded text-left overflow-auto max-h-24">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 ml-2" />
              נסה שוב
            </Button>
            <Button onClick={this.handleReload}>רענן את הדף</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
