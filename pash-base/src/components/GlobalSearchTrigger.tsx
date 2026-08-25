import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SearchCheck } from "lucide-react";
import { SearchDialog } from "@/components/SearchDialog";

interface GlobalSearchTriggerProps {
  onNavigateToPasuk?: (sefer: number, perek: number, pasuk: number) => void;
}

export function GlobalSearchTrigger({ onNavigateToPasuk }: GlobalSearchTriggerProps) {
  const [open, setOpen] = useState(false);

  // Listen for Ctrl+K / Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10 border border-accent/30 rounded-md"
        aria-label="חיפוש בתורה (Ctrl+K)"
        title="חיפוש (Ctrl+K)"
      >
        <SearchCheck className="h-4 w-4" />
      </Button>

      <SearchDialog open={open} onOpenChange={setOpen} onNavigateToPasuk={onNavigateToPasuk} />
    </>
  );
}
