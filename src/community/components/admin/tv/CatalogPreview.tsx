import { useEffect, useRef, useState } from "react";
import { BoardElements } from "@/tv/BoardElements";
import type { BoardElement } from "@/tv/elements";

/**
 * A kit's layers drawn small, on its own background - drawn only when the
 * tile comes near the screen: the library holds dozens of kits, each of
 * dozens of layers.
 */
export function CatalogPreview({ elements, background }: { elements: BoardElement[]; background?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      data-testid="kit-thumb"
      // Isolated: the layers stack inside the tile, never over the editor's pinned bars.
      className="relative isolate aspect-video w-full overflow-hidden"
      style={{ containerType: "size", background: background ?? "#0b1628" }}
    >
      {visible && <BoardElements elements={elements} />}
    </div>
  );
}
