import { memo, useMemo } from "react";
import { FlatPasuk } from "@/types/torah";
import { PasukDisplay } from "@/components/PasukDisplay";
import { useBackgroundTask } from "@/hooks/useBackgroundTask";
import { useDataChunking } from "@/hooks/useDataChunking";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OptimizedPasukListProps {
  pesukim: FlatPasuk[];
  seferId: number;
  forceMinimized?: boolean;
  chunkSize?: number;
}

/**
 * Optimized component for rendering large lists of pesukim
 * Uses chunking and background processing for better performance
 */
const OptimizedPasukList = ({ 
  pesukim, 
  seferId, 
  forceMinimized = false,
  chunkSize = 20 
}: OptimizedPasukListProps) => {
  const {
    loadedData,
    loadNextChunk,
    loadAll,
    hasMore,
    isLoading,
    progress,
  } = useDataChunking(pesukim, chunkSize);

  const { scheduleTask } = useBackgroundTask();

  // Pre-process data in background
  useMemo(() => {
    if (pesukim.length > 100) {
      scheduleTask(() => {
      });
    }
  }, [pesukim, scheduleTask]);

  return (
    <div className="space-y-4">
      {loadedData.map((pasuk) => (
        <PasukDisplay
          key={pasuk.id}
          pasuk={pasuk}
          seferId={seferId}
          forceMinimized={forceMinimized}
        />
      ))}
      
      {hasMore && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-full max-w-xs bg-secondary/20 rounded-full h-2">
            <div 
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={loadNextChunk}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  טוען...
                </>
              ) : (
                `טען עוד ${chunkSize} פסוקים`
              )}
            </Button>
            
            <Button
              onClick={loadAll}
              disabled={isLoading}
              variant="secondary"
              size="sm"
            >
              טען הכל
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {loadedData.length} מתוך {pesukim.length} פסוקים
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(OptimizedPasukList);
