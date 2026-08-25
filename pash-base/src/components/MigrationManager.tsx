/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Database,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  FileText,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plug,
  Terminal,
  User,
  Copy,
  SquareTerminal,
  Eraser,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MigrationEntry {
  name: string;
  sql: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  error?: string;
  timestamp?: string;
}

interface ExistingMigration {
  version: string;
  name: string;
  statements_count: number;
}

const KNOWN_MIGRATIONS: ExistingMigration[] = [
  { version: "20251201131314", name: "remix_migration_from_pg_dump", statements_count: 0 },
  { version: "20260218161423", name: "193a5251-5b1f-4cdc-931a-3d760828300a", statements_count: 0 },
  { version: "20260306000000", name: "rashi_commentary", statements_count: 0 },
  { version: "20260308000000", name: "commentaries_unified", statements_count: 0 },
  { version: "20260309000000", name: "exec_sql_function", statements_count: 0 },
];

const parseMigrationStatements = (sql: string): string[] => {
  // Split by semicolons but respect $$ and $tag$ blocks (function bodies, DO blocks)
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let dollarTag: string | null = null; // tracks the current $...$ tag

  while (i < sql.length) {
    const ch = sql[i];

    // Check for dollar-quoted string start/end: $$ or $tag$
    if (ch === "$") {
      // Try to match a dollar tag: $identifier$ or $$
      const rest = sql.substring(i);
      const m = rest.match(/^(\$[A-Za-z_]*\$)/);
      if (m) {
        const tag = m[1];
        if (dollarTag === null) {
          // entering dollar-quoted block
          dollarTag = tag;
          current += tag;
          i += tag.length;
          continue;
        } else if (dollarTag === tag) {
          // exiting dollar-quoted block
          current += tag;
          i += tag.length;
          dollarTag = null;
          continue;
        }
      }
    }

    if (ch === ";" && dollarTag === null) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }

    // Skip single-line comments (but preserve them in statements for readability)
    if (ch === "-" && sql[i + 1] === "-" && dollarTag === null) {
      const eol = sql.indexOf("\n", i);
      if (eol === -1) {
        current += sql.substring(i);
        i = sql.length;
      } else {
        current += sql.substring(i, eol + 1);
        i = eol + 1;
      }
      continue;
    }

    current += ch;
    i++;
  }
  const last = current.trim();
  if (last.length > 0) statements.push(last);

  return statements;
};

const validateSQL = (sql: string): { valid: boolean; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!sql.trim()) {
    errors.push("קובץ ריק — אין הצהרות SQL");
    return { valid: false, warnings, errors };
  }

  const lower = sql.toLowerCase();

  // Dangerous patterns
  if (lower.includes("drop database")) {
    errors.push("DROP DATABASE אסור");
  }
  if (lower.includes("alter database postgres")) {
    errors.push("ALTER DATABASE postgres אסור בסביבת Cloud");
  }

  // Reserved schemas
  const reservedSchemas = ["auth.", "storage.", "realtime.", "supabase_functions.", "vault."];
  for (const schema of reservedSchemas) {
    if (lower.includes(schema)) {
      warnings.push(`שימוש בסכמה שמורה: ${schema.replace(".", "")} — ייתכן שזה יגרום לבעיות`);
    }
  }

  // Destructive operations warning
  if (lower.includes("drop table")) {
    warnings.push("מכיל DROP TABLE — ודא שאתה יודע מה אתה עושה");
  }
  if (lower.includes("truncate")) {
    warnings.push("מכיל TRUNCATE — זה ימחק את כל הנתונים בטבלה");
  }

  const statements = parseMigrationStatements(sql);
  if (statements.length > 50) {
    warnings.push(`מכיל ${statements.length} הצהרות — מיגרציה גדולה`);
  }

  return { valid: errors.length === 0, warnings, errors };
};

interface ExecResult {
  success: boolean;
  error?: string;
  detail?: string;
  hint?: string;
  rows_affected?: number;
  duration_ms?: number;
  statement_type?: string;
}

const execSQL = async (sql: string): Promise<ExecResult> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("exec_sql", { query: sql });
  if (error) {
    return { success: false, error: error.message, detail: error.code };
  }
  if (data && typeof data === "object") {
    return data as ExecResult;
  }
  return { success: true };
};

/** Summarize a SQL statement for the log (first meaningful line, max 80 chars) */
const summarizeSQL = (sql: string): string => {
  const line = sql
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("--")) || sql.trim();
  return line.length > 80 ? line.substring(0, 77) + "..." : line;
};

interface LogEntry {
  id: number;
  time: string;
  level: "info" | "success" | "error" | "warn" | "running";
  message: string;
  detail?: string;
}

export const MigrationManager = () => {
  const [migrations, setMigrations] = useState<MigrationEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedMigration, setExpandedMigration] = useState<string | null>(null);
  const [showExisting, setShowExisting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "connected" | "error">("idle");
  const [connectionInfo, setConnectionInfo] = useState("");
  const [directSQL, setDirectSQL] = useState("");
  const [isRunningDirect, setIsRunningDirect] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [consoleLog, setConsoleLog] = useState<LogEntry[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const logIdRef = useRef(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry["level"], message: string, detail?: string) => {
    const entry: LogEntry = {
      id: ++logIdRef.current,
      time: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level,
      message,
      detail,
    };
    setConsoleLog((prev) => [...prev, entry]);
    // Auto-scroll
    setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    return entry.id;
  }, []);

  const updateLog = useCallback((id: number, level: LogEntry["level"], message: string, detail?: string) => {
    setConsoleLog((prev) =>
      prev.map((e) => (e.id === id ? { ...e, level, message, detail } : e))
    );
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const testConnection = useCallback(async () => {
    setConnectionStatus("testing");
    setConnectionInfo("");
    addLog("info", "בודק חיבור לדאטהבייס...");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setConnectionStatus("error");
        setConnectionInfo("לא מחובר — יש להתחבר לחשבון קודם");
        addLog("error", "לא מחובר — נדרשת כניסה לחשבון");
        return;
      }

      addLog("info", `מחובר כ-${session.session.user.email}, בודק exec_sql...`);
      const result = await execSQL("SELECT 1");
      if (result.success) {
        setConnectionStatus("connected");
        const info = `מחובר בהצלחה כ-${session.session.user.email}`;
        setConnectionInfo(info);
        addLog("success", info, result.duration_ms ? `${result.duration_ms}ms` : undefined);
      } else {
        setConnectionStatus("error");
        const errMsg = result.error || "exec_sql לא זמין";
        setConnectionInfo(errMsg);
        addLog("error", `בדיקת חיבור נכשלה: ${errMsg}`, result.detail);
      }
    } catch (err: any) {
      setConnectionStatus("error");
      setConnectionInfo(err?.message || "שגיאת חיבור");
      addLog("error", `שגיאת חיבור: ${err?.message}`);
    }
  }, [addLog]);

  const runDirectSQL = useCallback(async () => {
    if (!directSQL.trim()) return;
    setIsRunningDirect(true);
    const logId = addLog("running", `מריץ SQL: ${summarizeSQL(directSQL)}`);
    try {
      const result = await execSQL(directSQL.trim());
      if (result.success) {
        const parts = [`הושלם בהצלחה`];
        if (result.rows_affected !== undefined) parts.push(`${result.rows_affected} שורות`);
        if (result.duration_ms !== undefined) parts.push(`${result.duration_ms}ms`);
        if (result.statement_type) parts.push(result.statement_type);
        updateLog(logId, "success", parts.join(" • "), summarizeSQL(directSQL));
        toast.success("✅ SQL הורץ בהצלחה");
      } else {
        updateLog(logId, "error", `שגיאה: ${result.error}`, result.detail ? `[${result.detail}] ${result.hint || ""}` : undefined);
        toast.error(`❌ ${result.error}`);
      }
    } catch (err: any) {
      updateLog(logId, "error", `שגיאה: ${err?.message}`);
      toast.error(`❌ ${err?.message}`);
    } finally {
      setIsRunningDirect(false);
    }
  }, [directSQL, addLog, updateLog]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.name.endsWith(".sql")) {
        toast.error(`${file.name} — רק קבצי .sql נתמכים`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const sql = ev.target?.result as string;
        const validation = validateSQL(sql);

        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.errors.join(", ")}`);
          return;
        }

        if (validation.warnings.length > 0) {
          toast.warning(`${file.name}: ${validation.warnings.join("; ")}`);
        }

        setMigrations((prev) => {
          // Don't add duplicates
          if (prev.some((m) => m.name === file.name)) {
            toast.info(`${file.name} כבר נוסף`);
            return prev;
          }
          return [
            ...prev,
            {
              name: file.name,
              sql,
              status: "pending",
              timestamp: new Date().toLocaleTimeString("he-IL"),
            },
          ];
        });
      };
      reader.readAsText(file);
    });

    // Reset input
    e.target.value = "";
  }, []);

  const runMigration = useCallback(async (index: number) => {
    setMigrations((prev) =>
      prev.map((m, i) => (i === index ? { ...m, status: "running" as const, error: undefined } : m))
    );

    const migration = migrations[index];
    const statements = parseMigrationStatements(migration.sql);
    const total = statements.length;

    addLog("info", `▶ מתחיל: ${migration.name} (${total} הצהרות)`);
    let successCount = 0;
    let totalDuration = 0;

    try {
      for (let si = 0; si < statements.length; si++) {
        const stmt = statements[si];
        const label = summarizeSQL(stmt);
        const logId = addLog("running", `[${si + 1}/${total}] ${label}`);

        const result = await execSQL(stmt);

        if (!result.success) {
          const errDetail = [result.error];
          if (result.detail) errDetail.push(`SQLSTATE: ${result.detail}`);
          if (result.hint) errDetail.push(result.hint);
          updateLog(logId, "error", `[${si + 1}/${total}] ✗ ${result.error}`, errDetail.slice(1).join(" | "));
          throw new Error(`הצהרה ${si + 1}/${total}: ${result.error}`);
        }

        const parts = [`[${si + 1}/${total}] ✓`];
        if (result.statement_type) parts.push(result.statement_type);
        if (result.rows_affected !== undefined && result.rows_affected > 0) parts.push(`${result.rows_affected} שורות`);
        if (result.duration_ms !== undefined) {
          parts.push(`${result.duration_ms}ms`);
          totalDuration += result.duration_ms;
        }
        updateLog(logId, "success", parts.join(" • "));
        successCount++;
      }

      setMigrations((prev) =>
        prev.map((m, i) => (i === index ? { ...m, status: "success" as const } : m))
      );
      addLog("success", `✅ ${migration.name} הושלם — ${successCount} הצהרות, ${totalDuration}ms`);
      toast.success(`✅ ${migration.name} הושלם בהצלחה`);
    } catch (err: any) {
      const errorMsg = err?.message || "שגיאה לא ידועה";
      setMigrations((prev) =>
        prev.map((m, i) => (i === index ? { ...m, status: "error" as const, error: errorMsg } : m))
      );
      addLog("error", `❌ ${migration.name} נכשל אחרי ${successCount}/${total} הצהרות: ${errorMsg}`);
      toast.error(`❌ ${migration.name}: ${errorMsg}`);
    }
  }, [migrations, addLog, updateLog]);

  const runAllPending = useCallback(async () => {
    setIsRunning(true);
    const pendingIndices = migrations
      .map((m, i) => (m.status === "pending" || m.status === "error" ? i : -1))
      .filter((i) => i >= 0);

    for (const idx of pendingIndices) {
      await runMigration(idx);
    }
    setIsRunning(false);
  }, [migrations, runMigration]);

  const removeMigration = useCallback((index: number) => {
    setMigrations((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setMigrations([]);
  }, []);

  const statusIcon = (status: MigrationEntry["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "skipped":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const statusLabel = (status: MigrationEntry["status"]) => {
    switch (status) {
      case "pending": return "ממתין";
      case "running": return "רץ...";
      case "success": return "הצליח";
      case "error": return "שגיאה";
      case "skipped": return "דולג";
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Connection test */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant={connectionStatus === "connected" ? "default" : "outline"}
            onClick={testConnection}
            disabled={connectionStatus === "testing"}
            className="gap-1.5"
          >
            {connectionStatus === "testing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : connectionStatus === "connected" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : connectionStatus === "error" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            {connectionStatus === "connected" ? "מחובר" : "בדוק חיבור"}
          </Button>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">חיבור לדאטהבייס</h3>
            <Database className="h-4 w-4 text-primary" />
          </div>
        </div>
        {connectionInfo && (
          <>
            <Separator />
            <div className={`text-xs p-2 rounded ${connectionStatus === "connected" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
              {connectionInfo}
            </div>
          </>
        )}
        {userEmail && (
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <span>{userEmail}</span>
            <User className="h-3 w-3" />
          </div>
        )}
      </Card>

      {/* Direct SQL */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            onClick={runDirectSQL}
            disabled={isRunningDirect || !directSQL.trim()}
            className="gap-1.5"
          >
            {isRunningDirect ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            הרץ
          </Button>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">הרצת SQL ישירה</h3>
            <Terminal className="h-4 w-4 text-primary" />
          </div>
        </div>
        <Textarea
          placeholder="SELECT COUNT(*) FROM commentaries"
          value={directSQL}
          onChange={(e) => setDirectSQL(e.target.value)}
          className="font-mono text-xs min-h-[60px]"
          dir="ltr"
        />
      </Card>

      {/* Console Output */}
      <Collapsible open={showConsole} onOpenChange={setShowConsole}>
        <Card className="p-0 overflow-hidden">
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-2">
              {showConsole ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {consoleLog.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {consoleLog.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">פלט קונסול</h3>
              <SquareTerminal className="h-4 w-4 text-primary" />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <Separator />
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    const text = consoleLog
                      .map((e) => `[${e.time}] ${e.level.toUpperCase()}: ${e.message}${e.detail ? ` — ${e.detail}` : ""}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    toast.success("הועתק ללוח");
                  }}
                  disabled={consoleLog.length === 0}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setConsoleLog([])}
                  disabled={consoleLog.length === 0}
                >
                  <Eraser className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {consoleLog.filter((e) => e.level === "error").length > 0
                  ? `${consoleLog.filter((e) => e.level === "error").length} שגיאות`
                  : consoleLog.length > 0
                    ? `${consoleLog.length} שורות`
                    : "ריק"}
              </span>
            </div>
            <ScrollArea className="h-[200px]">
              <div className="p-2 font-mono text-[11px] space-y-0.5 bg-[#1a1a2e] text-gray-300 min-h-full" dir="ltr">
                {consoleLog.length === 0 && (
                  <div className="text-gray-500 text-center py-8">
                    Console output will appear here...
                  </div>
                )}
                {consoleLog.map((entry) => (
                  <div key={entry.id} className="flex gap-1.5 leading-relaxed">
                    <span className="text-gray-500 shrink-0 select-none">{entry.time}</span>
                    <span className="shrink-0 select-none">
                      {entry.level === "success" && <span className="text-green-400">✓</span>}
                      {entry.level === "error" && <span className="text-red-400">✗</span>}
                      {entry.level === "warn" && <span className="text-yellow-400">⚠</span>}
                      {entry.level === "info" && <span className="text-blue-400">ℹ</span>}
                      {entry.level === "running" && <span className="text-cyan-400 animate-pulse">●</span>}
                    </span>
                    <span className={
                      entry.level === "error" ? "text-red-300" :
                      entry.level === "success" ? "text-green-300" :
                      entry.level === "warn" ? "text-yellow-300" :
                      entry.level === "running" ? "text-cyan-300" :
                      "text-gray-300"
                    }>
                      {entry.message}
                      {entry.detail && (
                        <span className="text-gray-500 mr-1"> — {entry.detail}</span>
                      )}
                    </span>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Existing migrations */}
      <Collapsible open={showExisting} onOpenChange={setShowExisting}>
        <Card className="p-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {showExisting ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">מיגרציות קיימות</h3>
              <Database className="h-4 w-4 text-primary" />
              <Badge variant="secondary" className="text-xs">
                {KNOWN_MIGRATIONS.length}
              </Badge>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 space-y-2">
            <Separator />
            {KNOWN_MIGRATIONS.map((m) => (
              <div
                key={m.version}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs"
              >
                <Badge variant="outline" className="text-[10px]">
                  {m.version}
                </Badge>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-mono text-xs">{m.name}</span>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Upload area */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {migrations.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground">
                נקה הכל
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">העלאת מיגרציות</h3>
            <Upload className="h-4 w-4 text-primary" />
          </div>
        </div>

        <Separator />

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-accent/30 rounded-xl p-6 cursor-pointer hover:border-accent/60 hover:bg-accent/5 transition-all">
          <FileText className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm font-medium text-muted-foreground">
            לחץ לבחירת קבצי SQL
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            ניתן להעלות מספר קבצים בו-זמנית
          </span>
          <input
            type="file"
            accept=".sql"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </Card>

      {/* Migration queue */}
      {migrations.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              onClick={runAllPending}
              disabled={isRunning || !migrations.some((m) => m.status === "pending" || m.status === "error")}
              className="gap-1.5"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              הרץ הכל
            </Button>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">תור מיגרציות</h3>
              <Badge variant="secondary" className="text-xs">
                {migrations.filter((m) => m.status === "pending").length} ממתינים
              </Badge>
            </div>
          </div>

          <Separator />

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {migrations.map((m, idx) => (
                <Collapsible
                  key={m.name}
                  open={expandedMigration === m.name}
                  onOpenChange={(open) => setExpandedMigration(open ? m.name : null)}
                >
                  <div className="rounded-lg border bg-card">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeMigration(idx);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>

                        {m.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              runMigration(idx);
                            }}
                          >
                            <Play className="h-3 w-3" />
                            הרץ
                          </Button>
                        )}

                        {m.status === "error" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              runMigration(idx);
                            }}
                          >
                            <Play className="h-3 w-3" />
                            נסה שוב
                          </Button>
                        )}
                      </div>

                      <CollapsibleTrigger className="flex items-center gap-2 flex-1 justify-end">
                        <Badge
                          variant={m.status === "error" ? "destructive" : m.status === "success" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {statusLabel(m.status)}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(m.status)}
                          <span className="text-sm font-mono truncate max-w-[180px]">
                            {m.name}
                          </span>
                        </div>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-2">
                        <Separator />
                        {m.error && (
                          <div className="p-2 rounded bg-destructive/10 text-destructive text-xs font-mono text-right">
                            {m.error}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {parseMigrationStatements(m.sql).length} הצהרות
                          {m.timestamp && <span className="mr-2">• נוסף ב-{m.timestamp}</span>}
                        </div>
                        <ScrollArea className="max-h-[200px]">
                          <pre className="text-[10px] font-mono bg-muted/30 rounded p-2 whitespace-pre-wrap text-right overflow-x-auto" dir="ltr">
                            {m.sql.substring(0, 2000)}
                            {m.sql.length > 2000 && "\n\n... (קוצר)"}
                          </pre>
                        </ScrollArea>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Info */}
      <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-lg space-y-1">
        <p className="font-semibold">💡 טיפים:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>מיגרציות מורצות לפי סדר ההעלאה</li>
          <li>שגיאות מזוהות ומוצגות — ניתן לנסות שוב</li>
          <li>אין לשנות סכמות שמורות (auth, storage, realtime)</li>
          <li>השתמש ב-CREATE OR REPLACE למניעת כפילויות</li>
        </ul>
      </div>
    </div>
  );
};
