import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for chunking large data arrays for better performance
 * Loads data in chunks to prevent blocking the main thread
 */
export const useDataChunking = <T,>(
  data: T[],
  chunkSize: number = 50
) => {
  const [loadedChunks, setLoadedChunks] = useState<T[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const totalChunks = Math.ceil(data.length / chunkSize);

  // Load initial chunk
  useEffect(() => {
    if (data.length === 0) return;
    
    setLoadedChunks(data.slice(0, chunkSize));
    setCurrentChunk(1);
  }, [data, chunkSize]);

  // Load next chunk
  const loadNextChunk = useCallback(() => {
    if (currentChunk >= totalChunks || isLoading) return;

    setIsLoading(true);
    
    // Use setTimeout to prevent blocking
    setTimeout(() => {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const nextChunk = data.slice(start, end);
      
      setLoadedChunks(prev => [...prev, ...nextChunk]);
      setCurrentChunk(prev => prev + 1);
      setIsLoading(false);
    }, 0);
  }, [currentChunk, totalChunks, chunkSize, data, isLoading]);

  // Load all remaining chunks
  const loadAll = useCallback(() => {
    if (currentChunk >= totalChunks) return;
    
    setLoadedChunks(data);
    setCurrentChunk(totalChunks);
  }, [currentChunk, totalChunks, data]);

  const hasMore = currentChunk < totalChunks;
  const progress = (currentChunk / totalChunks) * 100;

  return {
    loadedData: loadedChunks,
    loadNextChunk,
    loadAll,
    hasMore,
    isLoading,
    progress,
    totalChunks,
    currentChunk,
  };
};
