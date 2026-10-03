import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { checkApiKey, useAccountApiKey, useApiKeyActions } from "@community/lib/apiKeys";
import { getPersonalKey, maskKey, setPersonalKey } from "@community/lib/aiIntakeDirect";

/**
 * "מפתח API": the gabbai's Claude key, kept with his account - entered once,
 * there on every device he signs in on, replaced or deleted here. It is what
 * "עוזר חכם" reads photos and dictation with, billed to his own Anthropic
 * account.
 */
export function ApiKeysAdmin() {
  const { data: key, isLoading } = useAccountApiKey();
  const actions = useApiKeyActions();
  const [draft, setDraft] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; message: string } | null>(null);
  // A key kept the old way, in this browser only: one click moves it to the account.
  const [local, setLocal] = useState<string | null>(() => getPersonalKey());

  const save = async (value: string, fromBrowser = false) => {
    setBusy(true);
    setCheck(null);
    try {
      await actions.save(value);
      if (fromBrowser) {
        setPersonalKey(null);
        setLocal(null);
      }
      setDraft("");
      setReplacing(false);
      toast.success(fromBrowser ? "המפתח עבר לחשבון - מעכשיו הוא זמין בכל מכשיר" : "המפתח נשמר בחשבון");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const showForm = !key || replacing;

  return (
    <div className="card-elev max-w-2xl space-y-4 p-5" dir="rtl" data-testid="api-keys">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">מפתח API של Claude</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        המפתח שאיתו "עוזר חכם" קורא תמונות, הקלטות והודעות. מכניסים אותו פעם אחת והוא נשמר בחשבון שלכם - זמין בכל מחשב
        ובכל טלפון שנכנסים ממנו לחשבון, בלי להכניס שוב. השימוש מחויב בחשבון שלכם ב-Anthropic.
      </p>
      <p className="flex items-start gap-1.5 rounded-md bg-muted/50 p-2 text-xs">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        רק החשבון שלכם רואה את המפתח - לא מנהלים אחרים ולא המתפללים. הוא נשלח רק ל-Anthropic. מומלץ לקבוע לו תקרת
        הוצאה חודשית בחשבון ב-Anthropic.
      </p>

      {isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          {key && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3" data-testid="api-key-status">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span className="font-medium">מפתח שמור</span>
              <span dir="ltr" className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                {maskKey(key)}
              </span>
              <div className="ms-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setCheck(await checkApiKey(key));
                    setBusy(false);
                  }}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} בדיקת המפתח
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setReplacing((r) => !r)}>
                  החלפה
                </Button>
                {confirmDelete ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await actions.remove();
                          toast.success("המפתח נמחק מהחשבון");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "המחיקה נכשלה");
                        }
                        setConfirmDelete(false);
                        setCheck(null);
                      }}
                    >
                      כן, למחוק
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      ביטול
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="size-4" /> מחיקה
                  </Button>
                )}
              </div>
            </div>
          )}

          {check && (
            <p className={`flex items-center gap-1.5 text-sm ${check.ok ? "text-emerald-700" : "text-destructive"}`} role="status">
              {check.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {check.message}
            </p>
          )}

          {!key && local && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <span>
                בדפדפן הזה שמור מפתח מהשיטה הקודמת (<span dir="ltr">{maskKey(local)}</span>).
              </span>
              <Button type="button" size="sm" disabled={busy} onClick={() => void save(local, true)}>
                העברה לחשבון
              </Button>
            </div>
          )}

          {showForm && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void save(draft);
              }}
            >
              <label className="block text-sm font-medium" htmlFor="claude-key">
                {key ? "מפתח חדש במקום הקיים" : "הדביקו כאן את המפתח"}
              </label>
              <div className="flex gap-2">
                <input
                  id="claude-key"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  dir="ltr"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="sk-ant-..."
                  aria-label="מפתח Claude"
                  className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                />
                <Button type="submit" size="sm" className="h-9" disabled={busy || !draft.trim()}>
                  שמירה
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                את המפתח יוצרים באתר של Anthropic, בחשבון שלכם, בעמוד "API Keys". הוא מתחיל ב-sk-ant-.
              </p>
            </form>
          )}
        </>
      )}
    </div>
  );
}
