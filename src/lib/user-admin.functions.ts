import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const roleSchema = z.enum(["admin", "user"]);
const createUserSchema = z.object({
  email: z.string().trim().email("כתובת האימייל אינה תקינה"),
  name: z.string().trim().max(100, "השם ארוך מדי"),
  password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים"),
  role: roleSchema,
});
const updateRoleSchema = z.object({ userId: z.string().uuid(), role: roleSchema });

type UserRole = z.infer<typeof roleSchema>;

function readableError(message: string) {
  if (message.includes("already exists")) return "כבר קיים משתמש עם כתובת האימייל הזאת";
  if (message.includes("last administrator")) return "לא ניתן להסיר את המנהל האחרון";
  if (message.includes("Admin access required")) return "הפעולה מותרת למנהל בלבד";
  return message;
}

export async function listUsers() {
  const [{ data, error }, { data: sessionData }] = await Promise.all([
    supabase.rpc("admin_list_users"),
    supabase.auth.getSession(),
  ]);
  if (error) throw new Error(readableError(error.message));
  const currentUserId = sessionData.session?.user.id;
  return (data ?? []).map((user) => ({
    ...user,
    role: (user.role === "admin" ? "admin" : "user") as UserRole,
    isCurrentUser: user.id === currentUserId,
  }));
}

export async function createUser({ data }: { data: z.input<typeof createUserSchema> }) {
  const input = createUserSchema.parse(data);
  const { data: userId, error } = await supabase.rpc("admin_create_user", {
    p_email: input.email,
    p_name: input.name,
    p_password: input.password,
    p_role: input.role,
  });
  if (error) throw new Error(readableError(error.message));
  return userId;
}

export async function updateUserRole({ data }: { data: z.input<typeof updateRoleSchema> }) {
  const input = updateRoleSchema.parse(data);
  const { error } = await supabase.rpc("admin_update_user_role", {
    p_user_id: input.userId,
    p_role: input.role,
  });
  if (error) throw new Error(readableError(error.message));
}
