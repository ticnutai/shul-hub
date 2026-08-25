import { Sparkles, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "@/lib/utils";

interface SyncIndicatorProps {
  status: 'synced' | 'syncing' | 'offline' | 'error';
  lastSynced?: number | null;
  onSync?: () => void;
}

export const SyncIndicator = ({ status, lastSynced, onSync }: SyncIndicatorProps) => {
  const getIcon = () => {
    switch (status) {
      case 'synced':
        return <Sparkles className="h-4 w-4 text-white" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-white animate-spin" />;
      case 'offline':
        return <CloudOff className="h-4 w-4 text-white/50" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-white" />;
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'synced':
        return lastSynced 
          ? `מסונכרן - ${new Date(lastSynced).toLocaleTimeString('he-IL')}`
          : 'מסונכרן';
      case 'syncing':
        return 'מסנכרן כעת...';
      case 'offline':
        return 'אופליין - לא מסונכרן';
      case 'error':
        return 'שגיאת סנכרון';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={status === 'syncing'}
            className={cn(
              "gap-2 text-white hover:text-white hover:bg-white/10 flex-row-reverse",
              status === 'offline' && "text-white/50"
            )}
          >
            <span className="text-xs hidden md:inline">{getMessage()}</span>
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getMessage()}</p>
          {onSync && <p className="text-xs mt-1">לחץ לסנכרון ידני</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
