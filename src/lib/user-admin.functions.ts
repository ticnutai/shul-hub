import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["admin", "user"]);

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error || !data) throw new Error("אין הרשאת מנהל לביצוע הפעולה");
  return supabaseAdmin;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const [{ data: authData, error: usersError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("user_roles").select("user_id, role, created_at"),
      ]);

    if (usersError) throw usersError;
    if (rolesError) throw rolesError;

    const rolesByUser = new Map<string, string[]>();
    for (const row of roles ?? []) {
      const current = rolesByUser.get(row.user_id) ?? [];
      current.push(row.role);
      rolesByUser.set(row.user_id, current);
    }

    return authData.users.map((user) => ({
      id: user.id,
      email: user.email ?? "",
      name: typeof user.user_metadata?.["name"] === "string" ? user.user_metadata["name"] : "",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      role: rolesByUser.get(user.id)?.includes("admin") ? ("admin" as const) : ("user" as const),
      isCurrentUser: user.id === context.userId,
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      email: z.string().trim().email(),
      name: z.string().trim().max(100),
      password: z.string().min(8).max(128),
      role: roleSchema,
    }),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await requireAdmin(context.userId);
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (createError) throw createError;
    if (!created.user) throw new Error("יצירת המשתמש נכשלה");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });

    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw roleError;
    }

    return { id: created.user.id };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ userId: z.string().uuid(), role: roleSchema }))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await requireAdmin(context.userId);

    if (data.role === "user") {
      const [{ count, error: countError }, { data: targetAdmin, error: targetError }] =
        await Promise.all([
          supabaseAdmin
            .from("user_roles")
            .select("id", { count: "exact", head: true })
            .eq("role", "admin"),
          supabaseAdmin
            .from("user_roles")
            .select("id")
            .eq("user_id", data.userId)
            .eq("role", "admin")
            .maybeSingle(),
        ]);
      if (countError) throw countError;
      if (targetError) throw targetError;
      if (targetAdmin && (count ?? 0) <= 1) {
        throw new Error("אי אפשר להסיר את הרשאת המנהל האחרון");
      }
    }

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (insertError) throw insertError;

    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role === "admin" ? "user" : "admin");
    if (deleteError) throw deleteError;

    return { success: true };
  });
