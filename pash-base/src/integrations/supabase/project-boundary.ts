const SHUL_HUB_PROJECT_REF = "bfiayuuhjtyccqobsjvl";
const SHUL_HUB_HOST = `${SHUL_HUB_PROJECT_REF}.supabase.co`;

export function assertShulHubSupabase(rawUrl: string | undefined): asserts rawUrl is string {
  if (!rawUrl) {
    throw new Error("Missing VITE_SUPABASE_URL for the Shul Hub integration");
  }

  let host: string;
  try {
    host = new URL(rawUrl).host;
  } catch {
    throw new Error("Invalid VITE_SUPABASE_URL for the Shul Hub integration");
  }

  if (host !== SHUL_HUB_HOST) {
    throw new Error(`Refusing unexpected Supabase project: ${host}`);
  }
}

export const SHUL_HUB_SUPABASE_HOST = SHUL_HUB_HOST;
