import { Skeleton } from "@/components/ui/skeleton";

export const SeferSkeleton = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Parsha Selector Skeleton */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="h-12 w-full rounded-lg animate-shimmer" 
            />
          ))}
        </div>
      </div>

      {/* Perek Selector Skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="h-10 w-16 rounded-md animate-shimmer" 
          />
        ))}
      </div>

      {/* Pesukim Content Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            className="animate-scale-in"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <Skeleton className="h-32 w-full rounded-lg animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
};
