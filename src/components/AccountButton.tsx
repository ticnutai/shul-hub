import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export function AccountButton() {
  const { session, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (loading || !session) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        aria-label="כניסה / הרשמה"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
      >
        <Link to="/auth">
          <LogIn className="size-5" />
        </Link>
      </Button>
    );
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="החשבון שלי"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
        >
          <User className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-right" dir="ltr">
          {session.user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin">פאנל ניהול</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4" /> יציאה
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
