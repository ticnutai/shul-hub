import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, Trash2, Upload } from "lucide-react";
import { supabase } from "@community/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BoardLogo } from "@/tv/config";

/**
 * The shared logo library (the logo_library table) and the logos this board
 * shows from it.
 *
 * One library for every synagogue on the system: a logo uploaded here -
 * the synagogue's own, a sponsor's - can be put on any board. The board keeps
 * a copy of what it chose (config.logos), so a TV that is offline still draws
 * it; whether a screen shows them is its "לוגואים" switch in the composer.
 */
interface LibraryLogo {
  id: string;
  name: string;
  url: string;
  path: string | null;
  url_dark: string | null;
  path_dark: string | null;
}

const MAX_BYTES = 3 * 1024 * 1024;
// The table is newer than the generated types; its rows are read as LibraryLogo.
const table = () => supabase.from("logo_library" as never);

const asBoardLogo = (l: LibraryLogo): BoardLogo => ({
  id: l.id,
  name: l.name,
  url: l.url,
  ...(l.url_dark ? { urlDark: l.url_dark } : {}),
});

async function upload(file: File): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" אינו קובץ תמונה`);
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" גדול מדי (עד 3MB)`);
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `logo-library/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("community-media").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return { url: supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl, path };
}

export function LogoLibrary({ chosen, onChange }: { chosen: BoardLogo[]; onChange: (logos: BoardLogo[]) => void }) {
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: ["logo_library"],
    queryFn: async () => {
      const { data, error } = await table().select("id,name,url,path,url_dark,path_dark").order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as LibraryLogo[];
    },
  });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lightFile = useRef<HTMLInputElement>(null);
  const darkFile = useRef<HTMLInputElement>(null);

  const isOn = (id: string) => chosen.some((l) => l.id === id);
  const toggle = (l: LibraryLogo) =>
    onChange(isOn(l.id) ? chosen.filter((c) => c.id !== l.id) : [...chosen, asBoardLogo(l)]);
  const raise = (id: string) => {
    const i = chosen.findIndex((c) => c.id === id);
    if (i <= 0) return;
    const next = [...chosen];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  async function add() {
    const light = lightFile.current?.files?.[0];
    if (!name.trim()) return toast.error("תנו שם ללוגו");
    if (!light) return toast.error("בחרו קובץ ללוגו");
    setBusy(true);
    const uploaded: string[] = [];
    try {
      const main = await upload(light);
      uploaded.push(main.path);
      const darkPick = darkFile.current?.files?.[0];
      const dark = darkPick ? await upload(darkPick) : null;
      if (dark) uploaded.push(dark.path);
      const { data, error } = await table()
        .insert({ name: name.trim().slice(0, 60), url: main.url, path: main.path, url_dark: dark?.url ?? null, path_dark: dark?.path ?? null } as never)
        .select("id,name,url,path,url_dark,path_dark")
        .single();
      if (error) throw error;
      const row = data as unknown as LibraryLogo;
      await queryClient.invalidateQueries({ queryKey: ["logo_library"] });
      onChange([...chosen, asBoardLogo(row)]);
      setName("");
      if (lightFile.current) lightFile.current.value = "";
      if (darkFile.current) darkFile.current.value = "";
      toast.success("הלוגו נוסף לספרייה ולוח הזה. לשמירה - \"שמור ושדר\".");
    } catch (e) {
      if (uploaded.length) void supabase.storage.from("community-media").remove(uploaded);
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function remove(l: LibraryLogo) {
    if (!window.confirm(`למחוק את "${l.name}" מהספרייה? לוחות של בתי כנסת אחרים שבחרו בו יפסיקו להציג אותו.`)) return;
    const { data, error } = await table().delete().eq("id", l.id).select("id");
    if (error || !data?.length) {
      // The table lets only whoever uploaded a logo, or a platform admin, remove it.
      return toast.error(error?.message ?? "רק מי שהעלה את הלוגו יכול למחוק אותו");
    }
    const paths = [l.path, l.path_dark].filter((p): p is string => Boolean(p));
    if (paths.length) void supabase.storage.from("community-media").remove(paths);
    onChange(chosen.filter((c) => c.id !== l.id));
    await queryClient.invalidateQueries({ queryKey: ["logo_library"] });
  }

  const logos = library.data ?? [];
  return (
    <div className="space-y-3" data-testid="logo-library">
      <p className="text-xs text-muted-foreground">
        ספרייה אחת לכל בתי הכנסת. סמנו אילו לוגואים יופיעו בלוח הזה; בכל מסך מדליקים או מכבים אותם במתג "לוגואים" (בפריסה).
      </p>
      {library.isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}
      {library.isError && <p className="text-sm text-destructive">לא ניתן לטעון את ספריית הלוגואים</p>}
      {!library.isLoading && logos.length === 0 && <p className="text-sm text-muted-foreground">אין עדיין לוגואים בספרייה.</p>}
      <ul className="space-y-2">
        {logos.map((l) => {
          const on = isOn(l.id);
          const place = chosen.findIndex((c) => c.id === l.id);
          return (
            <li key={l.id} data-logo={l.id} className="flex items-center gap-3 rounded-md border p-2">
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(l)}
                aria-label={`${l.name} בלוח הזה`}
                className="size-4"
              />
              <div className="flex gap-1">
                <span className="grid h-10 w-20 place-items-center rounded bg-[#f3ead3] p-1">
                  <img src={l.url} alt="" className="max-h-full max-w-full object-contain" />
                </span>
                {l.url_dark && (
                  <span className="grid h-10 w-20 place-items-center rounded bg-[#10182c] p-1" title="לרקע כהה">
                    <img src={l.url_dark} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                )}
              </div>
              <span className="flex-1 text-sm">{l.name}</span>
              {on && place > 0 && (
                <Button type="button" size="icon" variant="ghost" aria-label={`${l.name} קודם`} onClick={() => raise(l.id)}>
                  <ArrowUp className="size-4" />
                </Button>
              )}
              <Button type="button" size="icon" variant="ghost" aria-label={`מחיקת ${l.name} מהספרייה`} onClick={() => void remove(l)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="text-sm font-medium">הוספת לוגו לספרייה</div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם הלוגו (למשל: בית הכנסת, שם התורם)" aria-label="שם הלוגו" maxLength={60} />
        <label className="block text-xs">
          הלוגו
          <input ref={lightFile} type="file" accept="image/*" className="mt-1 block w-full text-xs" aria-label="קובץ הלוגו" />
        </label>
        <label className="block text-xs">
          גרסה לרקע כהה (לא חובה)
          <input ref={darkFile} type="file" accept="image/*" className="mt-1 block w-full text-xs" aria-label="קובץ לרקע כהה" />
        </label>
        <Button type="button" size="sm" onClick={() => void add()} disabled={busy}>
          <Upload className="size-4" />
          {busy ? "מעלה…" : "הוספה לספרייה ולוח הזה"}
        </Button>
      </div>
    </div>
  );
}
