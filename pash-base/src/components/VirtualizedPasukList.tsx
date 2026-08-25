import { useRef, useState, useEffect } from "react";
import { FlatPasuk } from "@/types/torah";
import { PasukDisplay } from "@/components/PasukDisplay";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface VirtualizedPasukListProps {
  pesukim: FlatPasuk[];
  seferId: number;
}

const ITEMS_PER_PAGE = 20;

export const VirtualizedPasukList = ({ pesukim, seferId }: VirtualizedPasukListProps) => {
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const displayedPesukim = pesukim.slice(0, displayedCount);
  const hasMore = displayedCount < pesukim.length;

  useEffect(() => {
    // Reset when pesukim change
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [pesukim]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoadingMore, displayedCount]);

  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Simulate loading delay for smooth UX
    setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + ITEMS_PER_PAGE, pesukim.length));
      setIsLoadingMore(false);
    }, 300);
  };

  return (
    <div className="space-y-4">
      {displayedPesukim.map((pasuk) => (
        <PasukDisplay key={pasuk.id} pasuk={pasuk} seferId={seferId} />
      ))}

      {/* Intersection observer target */}
      {hasMore && (
        <div ref={observerTarget} className="py-8 flex items-center justify-center">
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>טוען עוד פסוקים...</span>
            </div>
          ) : (
            <Button onClick={loadMore} variant="outline" size="lg">
              טען עוד ({pesukim.length - displayedCount} נותרו)
            </Button>
          )}
        </div>
      )}

      {!hasMore && pesukim.length > 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          הוצגו כל {pesukim.length} הפסוקים
        </div>
      )}
    </div>
  );
};
