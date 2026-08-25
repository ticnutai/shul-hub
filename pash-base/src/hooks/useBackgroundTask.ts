import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for running tasks in the background without blocking the UI
 * Uses requestIdleCallback or setTimeout fallback
 */
export const useBackgroundTask = () => {
  const taskQueueRef = useRef<Array<() => void>>([]);
  const isProcessingRef = useRef(false);

  const requestIdleCallback = 
    (typeof window !== 'undefined' && 'requestIdleCallback' in window)
      ? window.requestIdleCallback
      : (cb: IdleRequestCallback) => setTimeout(() => cb({ 
          didTimeout: false, 
          timeRemaining: () => 50 
        } as IdleDeadline), 1);

  const cancelIdleCallback = 
    (typeof window !== 'undefined' && 'cancelIdleCallback' in window)
      ? window.cancelIdleCallback
      : clearTimeout;

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || taskQueueRef.current.length === 0) return;

    isProcessingRef.current = true;

    const processTask = (deadline: IdleDeadline) => {
      while (
        (deadline.timeRemaining() > 0 || deadline.didTimeout) &&
        taskQueueRef.current.length > 0
      ) {
        const task = taskQueueRef.current.shift();
        if (task) {
          try {
            task();
          } catch (error) {
            console.error('Background task error:', error);
          }
        }
      }

      if (taskQueueRef.current.length > 0) {
        requestIdleCallback(processTask);
      } else {
        isProcessingRef.current = false;
      }
    };

    requestIdleCallback(processTask);
  }, []);

  const scheduleTask = useCallback((task: () => void) => {
    taskQueueRef.current.push(task);
    processQueue();
  }, [processQueue]);

  const scheduleTasks = useCallback((tasks: Array<() => void>) => {
    taskQueueRef.current.push(...tasks);
    processQueue();
  }, [processQueue]);

  const clearQueue = useCallback(() => {
    taskQueueRef.current = [];
    isProcessingRef.current = false;
  }, []);

  return {
    scheduleTask,
    scheduleTasks,
    clearQueue,
    queueSize: taskQueueRef.current.length,
  };
};
