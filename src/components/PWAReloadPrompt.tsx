import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export function PWAReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
    },
    onRegisterError(error) {
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <>
      {(offlineReady || needRefresh) && (
        <div className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {offlineReady ? (
                <p className="text-sm font-medium">האפליקציה מוכנה לעבודה offline!</p>
              ) : (
                <p className="text-sm font-medium">גרסה חדשה זמינה - רענן כדי לעדכן</p>
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
              רענן עכשיו
            </Button>
          )}
        </div>
      )}
    </>
  );
}
