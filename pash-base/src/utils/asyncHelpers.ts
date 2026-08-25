/**
 * Async helper utilities for preventing main thread blocking
 */

/**
 * Yield control back to the browser to prevent blocking
 * Uses scheduler.yield() if available, falls back to setTimeout
 */
export async function yieldToMain(): Promise<void> {
  // Use scheduler.yield if available (Chrome 94+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ('scheduler' in window && 'yield' in (window.scheduler as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window.scheduler as any).yield();
    return;
  }
  
  // Fallback to setTimeout for older browsers
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Process array in chunks to prevent blocking
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => R,
  chunkSize: number = 50
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(...chunk.map(processor));
    
    // Yield every chunk to prevent blocking
    if (i + chunkSize < items.length) {
      await yieldToMain();
    }
  }
  
  return results;
}
