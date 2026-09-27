/**
 * The last thing standing between a thrown error and a blank wall.
 *
 * React's answer to a component that throws during render is to unmount the
 * whole tree. On a laptop that is a white page somebody reloads. On a screen
 * bolted above the aron kodesh it is a white rectangle that stays white until
 * a person walks over with a ladder, and none of the other guards notices:
 * the copy on the device only covers the server going away, and the main
 * thread watch only covers a board that is still running and spinning.
 *
 * So this catches it, says what it was, puts something legible on the wall,
 * and reloads. The reload is the recovery - the board comes back from the
 * device's own copy inside a second, which is what carrying on without the
 * server actually looks like here.
 *
 * It sits outside everything, including the component that installs the log
 * sink, so that a board which throws on its very first render is still caught.
 * The report is best effort for exactly that reason.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

import { CRASH_RECOVERY, noteCrashAndDecide, reportWatchdog } from "./watchdog";

interface Props {
  children: ReactNode;
  /**
   * Reload after a crash. True on the wall, where nobody is watching and a
   * reload is the only way back; false in a browser, where an admin is
   * reading the message and a page that reloads under them is worse than the
   * error.
   */
  recover: boolean;
  reload?: () => void;
}

interface State {
  message: string | null;
  /** Reload attempts are spent; the message stays until somebody acts. */
  giveUp: boolean;
}

export class BoardCrashGuard extends Component<Props, State> {
  state: State = { message: null, giveUp: false };
  private timer: number | null = null;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // The real message, and the component it came from. Worth saying out
    // loud: an error thrown by a chunk the browser considers cross-origin
    // reaches window.onerror as the bare string "Script error.", which is
    // what the screen log has been filling up with and which says nothing.
    const message = error instanceof Error ? error.message : String(error);
    const where = info.componentStack?.trim().split("\n")[0]?.trim();
    reportWatchdog("error", `הלוח נפל: ${message}`, where ? { where } : undefined);

    if (!this.props.recover) return;
    const { reload, crashes } = noteCrashAndDecide();
    if (!reload) {
      reportWatchdog(
        "error",
        `הלוח נפל ${crashes} פעמים ברבע שעה - מפסיק לנסות ומשאיר את ההודעה על המסך`,
      );
      this.setState({ giveUp: true });
      return;
    }
    reportWatchdog("warn", `טעינה מחדש אחרי נפילה (${crashes})`);
    this.timer = window.setTimeout(
      () => (this.props.reload ?? (() => window.location.reload()))(),
      CRASH_RECOVERY.delayMs,
    );
  }

  componentWillUnmount() {
    if (this.timer !== null) window.clearTimeout(this.timer);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <div
        dir="rtl"
        role="alert"
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
          textAlign: "center",
          // Not the theme's colours: the theme is part of what just failed.
          background: "#0b1628",
          color: "#f4f7fb",
          fontFamily: "'Noto Serif Hebrew', 'David Libre', serif",
        }}
      >
        <div style={{ fontSize: "clamp(1.4rem, 3.2vw, 2.4rem)", color: "#f0c35c" }}>
          {this.state.giveUp ? "הלוח לא מצליח לעלות" : "הלוח חוזר בעוד רגע"}
        </div>
        <div style={{ fontSize: "clamp(0.9rem, 1.6vw, 1.2rem)", opacity: 0.75, maxWidth: "48rem" }}>
          {this.state.giveUp
            ? "אפשר לצלם את המסך הזה ולשלוח לגבאי. כיבוי והדלקה של הקופסה יחזירו את הלוח."
            : "אירעה תקלה והלוח נטען מחדש מעצמו."}
        </div>
        <code
          style={{
            fontSize: "0.75rem",
            opacity: 0.45,
            maxWidth: "60rem",
            direction: "ltr",
            wordBreak: "break-word",
          }}
        >
          {this.state.message}
        </code>
      </div>
    );
  }
}
