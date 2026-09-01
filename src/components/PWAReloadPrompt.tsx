import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export function PWAReloadPrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const updateInProgress = useRef(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swScriptUrl, registered) {
      if (!registered) return;
      setRegistration(registered);

      // Do not let a browser or CDN-cached sw.js delay deployment discovery.
      const scope = new URL(registered.scope).pathname;
      void navigator.serviceWorker.register(swScriptUrl, {
        scope,
        updateViaCache: 'none',
      }).then(setRegistration).catch(() => {
        setRegistration(registered);
      });
    },
    onRegisterError(error) {
    },
  });

  useEffect(() => {
    if (!registration) return;

    const checkForUpdate = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;
      void registration.update().catch(() => {});
    };

    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, 60_000);
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', checkForUpdate);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, [registration]);

  useEffect(() => {
    if (!needRefresh || updateInProgress.current) return;
    updateInProgress.current = true;
    void updateServiceWorker(true).catch(() => {
      updateInProgress.current = false;
    });
  }, [needRefresh, updateServiceWorker]);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div
          className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg max-w-sm"
          style={{ bottom: "calc(1rem + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {offlineReady ? (
                <p className="text-sm font-medium">האפליקציה מוכנה לעבודה offline!</p>
              ) : (
                <p className="text-sm font-medium">מעדכן אוטומטית לגרסה החדשה…</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className="h-6 w-6 hover:bg-primary-foreground/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {needRefresh && (
            <Button
              onClick={() => updateServiceWorker(true)}
              className="mt-3 w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 ml-2" />
              עדכן עכשיו
            </Button>
          )}
        </div>
      )}
    </>
  );
}
