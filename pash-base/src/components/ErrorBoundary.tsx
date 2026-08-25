import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 gap-4 text-center" dir="rtl">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">
            {this.props.fallbackTitle || "משהו השתבש"}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            אירעה שגיאה בלתי צפויה. נסה לרענן את הדף או לחזור אחורה.
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
