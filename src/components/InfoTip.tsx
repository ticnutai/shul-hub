/**
 * An explanation that takes no room: a small ⓘ, and the words open under it
 * on a click (and close on another, on Esc, or on a click elsewhere). The
 * words stay in the page while closed - hidden, not removed - so what reads
 * the page aloud still has them.
 */
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Info } from "lucide-react";

export function InfoTip({ children, label = "הסבר", className = "" }: { children: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span ref={box} className={`relative inline-flex align-middle ${className}`} data-info-tip>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={open ? "סגירת ההסבר" : "הסבר"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full transition ${open ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      <span
        role="note"
        hidden={!open}
        className="absolute start-0 top-6 z-[70] w-72 max-w-[min(18rem,80vw)] whitespace-normal rounded-md border bg-popover p-2.5 text-start text-xs font-normal leading-relaxed text-popover-foreground shadow-lg"
      >
        {children}
      </span>
    </span>
  );
}

/** A line of explanation on its own: the ⓘ alone, where the line was. */
export function Hint({ children, className = "", ...rest }: { children: ReactNode; className?: string } & Omit<HTMLAttributes<HTMLDivElement>, "children">) {
  return (
    <div {...rest} className={`flex ${className}`} data-hint>
      <InfoTip>{children}</InfoTip>
    </div>
  );
}
