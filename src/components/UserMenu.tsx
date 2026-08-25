import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, CircleUser, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const UserMenu = ({ iconOnly = false }: { iconOnly?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAnonymous = Boolean(user?.is_anonymous);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("התנתקת בהצלחה");
      navigate("/community");
    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error("שגיאה בניתוק");
    }
  };

  if (!user) {
    return (
      <Button
        variant="ghost"
        size={iconOnly ? "icon" : undefined}
        onClick={() => navigate("/auth")}
        className={iconOnly ? "h-8 w-8 text-white hover:text-white hover:bg-white/10" : "gap-2 text-white hover:text-white hover:bg-white/10 flex-row-reverse"}
      >
        {iconOnly ? <LogIn className="h-4 w-4" /> : <><span>התחבר</span><LogIn className="h-4 w-4" /></>}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : undefined}
          className={iconOnly ? "h-8 w-8 text-white hover:text-white hover:bg-white/10" : "gap-2 text-white hover:text-white hover:bg-white/10 flex-row-reverse max-w-[140px]"}
        >
          {iconOnly ? (
            <CircleUser className="h-4 w-4" />
          ) : (
            <><span className="truncate">{isAnonymous ? "אורח" : user.email?.split("@")[0]}</span><CircleUser className="h-4 w-4 flex-shrink-0" /></>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-right">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">החשבון שלי</span>
            <span className="text-xs text-muted-foreground">
              {isAnonymous ? "מצב אורח" : user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAnonymous && (
          <DropdownMenuItem onClick={() => navigate("/auth")} className="gap-2 cursor-pointer">
            <LogIn className="h-4 w-4" />
            <span>התחבר לחשבון</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 cursor-pointer">
          <UserCircle className="h-4 w-4" />
          <span>המערכת שלי</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer">
          <LogOut className="h-4 w-4" />
          <span>התנתק</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
