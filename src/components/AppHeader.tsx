import { Book } from "lucide-react";
import { SyncIndicator } from "@/components/SyncIndicator";
import { GlobalSearchTrigger } from "@/components/GlobalSearchTrigger";
import { InlineSearch } from "@/components/InlineSearch";
import { UserMenu } from "@/components/UserMenu";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load settings - not needed immediately
const Settings = lazy(() => import("@/components/Settings").then(m => ({ default: m.Settings })));

const SettingsSkeleton = () => <Skeleton className="h-9 w-9 rounded-md" />;

interface AppHeaderProps {
  isMobile: boolean;
  syncStatus: 'syncing' | 'synced' | 'error';
  onNavigateToPasuk?: (sefer: number, perek: number, pasuk: number) => void;
}

export const AppHeader = ({ isMobile, syncStatus, onNavigateToPasuk }: AppHeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ paddingTop: 'max(var(--safe-area-inset-top, var(--sai-top, env(safe-area-inset-top, 0px))), 28px)' }}>
      <div className="container flex h-14 items-center px-4 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Book className="h-5 w-5 text-primary" />
          {!isMobile && <h1 className="text-lg font-semibold">חמישה חומשי תורה עם פירושים</h1>}
        </div>

        {/* Inline quick search */}
        <div className="flex-1 flex justify-center">
          <InlineSearch onNavigateToPasuk={onNavigateToPasuk} />
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {!isMobile && <SyncIndicator status={syncStatus} />}
          <Suspense fallback={<SettingsSkeleton />}>
            <Settings />
          </Suspense>
          <GlobalSearchTrigger onNavigateToPasuk={onNavigateToPasuk} />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
