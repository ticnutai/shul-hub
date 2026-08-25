/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles, type AppRole } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ArrowRight, Search } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  roles: AppRole[];
}

const ALL_ROLES: AppRole[] = ["admin", "editor", "viewer", "user"];

const roleLabels: Record<AppRole, string> = {
  admin: "מנהל",
  editor: "עורך",
  viewer: "צופה",
  user: "משתמש",
};

const roleColors: Record<AppRole, string> = {
  admin: "bg-red-500/15 text-red-700 border-red-500/30",
  editor: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  viewer: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  user: "bg-gray-500/15 text-gray-700 border-gray-500/30",
};

const AdminPermissions = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || rolesLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("אין לך הרשאת אדמין");
      navigate("/");
    }
  }, [user, isAdmin, authLoading, rolesLoading, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("list_users_with_roles");
    if (error) {
      toast.error("טעינת המשתמשים נכשלה: " + error.message);
      setUsers([]);
    } else {
      setUsers((data ?? []) as UserRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin]);

  const toggleRole = async (targetUserId: string, role: AppRole, hasIt: boolean) => {
    const key = `${targetUserId}:${role}`;
    setBusyKey(key);
    const { error } = await (supabase as any).rpc("set_user_role", {
      _target_user_id: targetUserId,
      _role: role,
      _grant: !hasIt,
    });
    if (error) {
      toast.error("עדכון נכשל: " + error.message);
    } else {
      toast.success(hasIt ? `${roleLabels[role]} הוסר` : `${roleLabels[role]} הוקצה`);
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === targetUserId
            ? {
                ...u,
                roles: hasIt ? u.roles.filter((r) => r !== role) : [...u.roles, role],
              }
            : u
        )
      );
    }
    setBusyKey(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        (u.display_name ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  if (authLoading || rolesLoading || (isAdmin && loading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <Shield className="h-6 w-6" />
          <h1 className="text-xl font-semibold">ניהול הרשאות משתמשים</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי אימייל או שם..."
            className="pr-10"
            dir="rtl"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          סה"כ {filtered.length} משתמשים
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-right">
                <th className="p-3 font-semibold">משתמש</th>
                <th className="p-3 font-semibold">תפקידים נוכחיים</th>
                {ALL_ROLES.map((role) => (
                  <th key={role} className="p-3 font-semibold text-center">
                    {roleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.user_id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3 align-top">
                    <div className="font-medium">{u.display_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-3 align-top">
                    <div dir="rtl" className="flex flex-wrap gap-1 justify-start">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        u.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={roleColors[r]}
                          >
                            {roleLabels[r]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  {ALL_ROLES.map((role) => {
                    const hasIt = u.roles.includes(role);
                    const key = `${u.user_id}:${role}`;
                    const isSelfAdminRemoval =
                      role === "admin" && hasIt && u.user_id === user?.id;
                    return (
                      <td key={role} className="p-3 text-center align-top">
                        <Button
                          size="sm"
                          variant={hasIt ? "default" : "outline"}
                          disabled={busyKey === key || isSelfAdminRemoval}
                          onClick={() => toggleRole(u.user_id, role, hasIt)}
                          title={
                            isSelfAdminRemoval
                              ? "לא ניתן להסיר אדמין מעצמך"
                              : undefined
                          }
                        >
                          {busyKey === key ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : hasIt ? (
                            "פעיל"
                          ) : (
                            "הקצה"
                          )}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={2 + ALL_ROLES.length} className="p-8 text-center text-muted-foreground">
                    לא נמצאו משתמשים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default AdminPermissions;