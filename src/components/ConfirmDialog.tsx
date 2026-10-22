/**
 * "בטוח?" asked one way across the site.
 *
 * There were five: the browser's own box (in English chrome, the page frozen
 * behind it), a question inside the row, a designed window, an unstyled line,
 * and - for most deletes - no question at all. Now every action that cannot
 * be taken back asks here, the same window and the same words:
 *
 *   if (!(await confirmAction({ title: "למחוק את המניין?", confirmLabel: "מחיקה" }))) return;
 *
 * Mounted once (ConfirmProvider, in App); without it - a test, a page outside
 * the app - it falls back to the browser's box rather than skip the question.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export interface ConfirmOptions {
  /** The question: "למחוק את המודעה „…”?" */
  title: string;
  /** What happens, in a line - and whether it can be undone. */
  description?: ReactNode;
  /** The action, as a noun: "מחיקה", "הסרה", "שחזור". Default "אישור". */
  confirmLabel?: string;
  /** Red, for what removes something. Default true. */
  destructive?: boolean;
  /** For what cannot be undone at all: the action waits until these words are typed (a synagogue's name). */
  typeToConfirm?: string;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let open: ((p: Pending) => void) | null = null;

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!open) {
    const text = typeof options.description === "string" ? `${options.title}\n${options.description}` : options.title;
    return Promise.resolve(typeof window !== "undefined" && window.confirm(text));
  }
  const show = open;
  return new Promise((resolve) => show({ ...options, resolve }));
}

export function ConfirmProvider() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    open = (p) => {
      setTyped("");
      setPending(p);
    };
    return () => {
      open = null;
    };
  }, []);
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  const destructive = pending?.destructive !== false;
  const blocked = Boolean(pending?.typeToConfirm) && typed.trim() !== pending?.typeToConfirm?.trim();
  return (
    <AlertDialog open={Boolean(pending)} onOpenChange={(v) => !v && close(false)}>
      <AlertDialogContent dir="rtl" data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          {pending?.description && <AlertDialogDescription>{pending.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {pending?.typeToConfirm && (
          <label className="space-y-1 text-sm">
            <span className="block">כדי לאשר, כתבו: <b>{pending.typeToConfirm}</b></span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="אישור בכתיבה"
              data-testid="confirm-type"
              className="h-9 w-full rounded-md border bg-background px-2"
            />
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
            disabled={blocked}
            onClick={(e) => {
              if (blocked) return e.preventDefault();
              close(true);
            }}
          >
            {pending?.confirmLabel ?? "אישור"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
