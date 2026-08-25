import { ReactNode, useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyLoadProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
}

export const LazyLoad = ({ 
  children, 
  fallback = <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>,
  rootMargin = '100px',
  threshold = 0.01
}: LazyLoadProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    const current = containerRef.current;
    if (current) {
      observer.observe(current);
    }

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, [rootMargin, threshold]);

  return (
    <div ref={containerRef}>
      {isVisible ? children : fallback}
    </div>
  );
};
