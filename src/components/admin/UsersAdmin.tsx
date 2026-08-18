import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser, listUsers, updateUserRole } from "@/lib/user-admin.functions";

type UserRole = "admin" | "user";

export function UsersAdmin() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });

  const addUser = useMutation({
    mutationFn: () => createUser({ data: { email, name, password, role } }),
    onSuccess: async () => {
      setEmail("");
      setName("");
      setPassword("");
      setRole("user");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("המשתמש נוסף בהצלחה");
    },
    onError: (error: Error) => toast.error(error.message || "יצירת המשתמש נכשלה"),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: UserRole }) =>
      updateUserRole({ data: { userId, role: nextRole } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("ההרשאה עודכנה");
    },
    onError: (error: Error) => toast.error(error.message || "עדכון ההרשאה נכשל"),
  });

  return (
    <div className="space-y-6">
      <section className="card-elev p-4 sm:p-6" aria-labelledby="add-user-title">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-secondary p-2 text-primary">
            <UserPlus className="size-5" />
          </span>
          <div>
            <h2 id="add-user-title" className="text-lg font-bold">
              הוספת משתמש
            </h2>
            <p className="text-sm text-muted-foreground">
              המשתמש יוכל להתחבר מיד עם הסיסמה הזמנית.
            </p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            addUser.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="new-user-name">שם</Label>
            <Input
              id="new-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-email">אימייל</Label>
            <Input
              id="new-user-email"
              type="email"
              dir="ltr"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">סיסמה זמנית</Label>
            <Input
              id="new-user-password"
              type="password"
              dir="ltr"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-role">סוג משתמש</Label>
            <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
              <SelectTrigger id="new-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">משתמש רגיל</SelectItem>
                <SelectItem value="admin">מנהל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={addUser.isPending} className="w-full sm:w-auto">
              <UserPlus className="size-4" /> {addUser.isPending ? "מוסיף…" : "הוספת משתמש"}
            </Button>
          </div>
        </form>
      </section>

      <section className="card-elev overflow-hidden" aria-labelledby="users-title">
        <div className="flex items-center gap-3 border-b border-border p-4 sm:p-6">
          <Users className="size-5 text-primary" />
          <h2 id="users-title" className="text-lg font-bold">
            משתמשים קיימים
          </h2>
        </div>
        {usersQuery.isLoading && (
          <p className="p-6 text-center text-muted-foreground">טוען משתמשים…</p>
        )}
        {usersQuery.isError && (
          <p className="p-6 text-center text-destructive">טעינת המשתמשים נכשלה.</p>
        )}
        <div className="divide-y divide-border">
          {usersQuery.data?.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {user.name || "ללא שם"}
                  {user.role === "admin" && (
                    <ShieldCheck className="size-4 text-gold" aria-label="מנהל" />
                  )}
                  {user.isCurrentUser && (
                    <span className="text-xs text-muted-foreground">(החשבון שלך)</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground" dir="ltr">
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`role-${user.id}`} className="shrink-0">
                  הרשאה
                </Label>
                <Select
                  value={user.role}
                  disabled={changeRole.isPending}
                  onValueChange={(nextRole: UserRole) =>
                    changeRole.mutate({ userId: user.id, nextRole })
                  }
                >
                  <SelectTrigger id={`role-${user.id}`} className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">משתמש רגיל</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
