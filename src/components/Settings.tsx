/* eslint-disable @typescript-eslint/no-explicit-any */
import { Settings as SettingsIcon, Palette, Type, Layout, Database, Calendar, BookmarkCheck, HardDrive, Bell, BellOff, Code, LogOut, MessageSquare, Camera, Eye, EyeOff, Plug, Plus, Trash2, Clock, Volume2, VolumeX, Activity, Save, Pencil, Copy, Loader2, CloudUpload } from "lucide-react";
import { LocalDBManager } from "@/components/LocalDBManager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme, Theme, type CustomAppTheme } from "@/contexts/ThemeContext";
import { useFontAndColorSettings } from "@/contexts/FontAndColorSettingsContext";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { DataManager } from "@/components/DataManager";
import { MigrationManager } from "@/components/MigrationManager";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_THEME_APPEARANCE, THEME_SHADOWS, ThemeAppearanceControls } from "@/components/ThemeAppearanceControls";
import { BookmarksDialog } from "@/components/BookmarksDialog";
import { getCalendarPreference, setCalendarPreference } from "@/utils/parshaUtils";
import { useNotifications } from "@/hooks/useNotifications";
import { useWebPush } from "@/hooks/useWebPush";
import { Input } from "@/components/ui/input";
import { getRememberedCredentials, getAutoLoginEnabled, setAutoLoginEnabled, clearRememberedCredentials } from "@/pages/Auth";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";

// ── API Keys cloud sync helpers ──────────────────────────
const API_KEY_FIELDS = [
  'api_openai_key', 'api_google_key', 'api_elevenlabs_key', 'api_anthropic_key',
  'api_twilio_sid', 'api_twilio_token', 'api_twilio_whatsapp_number',
  'api_sendgrid_key', 'api_sendgrid_from', 'api_mailgun_key', 'api_mailgun_domain',
  'api_vapid_public_key', 'api_vapid_private_key', 'api_vapid_subject',
] as const;

type ApiKeys = Partial<Record<string, string>>;

const loadLocalApiKeys = (): ApiKeys => {
  const keys: ApiKeys = {};
  for (const k of API_KEY_FIELDS) {
    const v = localStorage.getItem(k);
    if (v) keys[k] = v;
  }
  return keys;
};

const saveApiKeyLocal = (key: string, value: string) => {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
};

const DEV_CHAT_ENABLED_KEY = "dev-chat-widget-enabled";
const DEBUG_RENDERS_KEY = "debug_renders";
const DEV_SCREENSHOT_ENABLED_KEY = "dev-screenshot-tool-enabled";
const DEV_FLOATING_ENABLED_KEY = "dev-floating-buttons-enabled";
const DEV_LAYOUT_EDITOR_ENABLED_KEY = "dev-layout-editor-enabled";
const DEV_CHUMASH_TRACE_KEY = "debug_chumash_trace";
const DEV_FEATURES_EVENT = "dev-features:changed";

const getDevFeatureEnabled = (key: string, defaultValue: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "true";
  } catch {
    return defaultValue;
  }
};

const AutoLoginSetting = () => {
  const remembered = getRememberedCredentials();
  const autoLogin = getAutoLoginEnabled();
  const { user } = useAuth();

  if (!remembered && !user) return null;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="font-semibold text-lg mb-2">כניסה אוטומטית</h3>
        <p className="text-sm text-muted-foreground">
          הגדר כניסה אוטומטית לחשבון שנשמר
        </p>
      </div>
      
      <Separator />

      {remembered && (
        <>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className="flex-1 text-right">
              <Label htmlFor="auto-login-toggle" className="text-base font-semibold cursor-pointer">
                כניסה אוטומטית
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                כאשר מופעל, תיכנס אוטומטית בלי לראות את דף הכניסה
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                חשבון שמור: {remembered.email}
              </p>
            </div>
            <Switch
              id="auto-login-toggle"
              checked={autoLogin}
              onCheckedChange={(checked) => {
                setAutoLoginEnabled(checked);
                toast.success(checked ? "כניסה אוטומטית הופעלה" : "כניסה אוטומטית כובתה");
              }}
            />
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              clearRememberedCredentials();
              toast.success("החשבון השמור נמחק. בכניסה הבאה תצטרך להזין פרטים מחדש.");
              // Force re-render
              window.location.reload();
            }}
          >
            <LogOut className="h-4 w-4" />
            <span>נתק חשבון שמור (שכח אותי)</span>
          </Button>
        </>
      )}

      {!remembered && user && (
        <div className="p-4 bg-muted/30 rounded-lg text-right">
          <p className="text-sm text-muted-foreground">
            כדי להפעיל כניסה אוטומטית, סמן "זכור אותי" בפעם הבאה שתתחבר.
          </p>
        </div>
      )}
    </Card>
  );
};

const themes = [
  { id: "light" as Theme, name: "בהיר", description: "נושא בהיר ונקי" },
  { id: "classic" as Theme, name: "קלאסי", description: "נושא מסורתי בגווני כחול וזהב" },
  { id: "navy" as Theme, name: "נייבי וזהב", description: "ערכת בית הכנסת המקורית" },
  { id: "jerusalem" as Theme, name: "אבן ירושלמית", description: "גווני אבן, עץ וזהב" },
  { id: "bordeaux" as Theme, name: "בורדו וזהב", description: "בורדו עמוק עם הדגשות זהב" },
  { id: "forest" as Theme, name: "ירוק זית", description: "ירוק מסורתי, שמנת וזהב" },
  { id: "sand" as Theme, name: "תכלת ולבן", description: "ערכת תכלת בהירה ונקייה" },
  { id: "night" as Theme, name: "מצב לילה", description: "כחול לילה וזהב לקריאה נוחה" },
  { id: "torah-luxury" as Theme, name: "פאר תורה", description: "כרטיסים בהירים, מסגרות זהב ואיקונים כחול־זהב" },
  { id: "pearl-gold" as Theme, name: "פנינה וזהב", description: "רקע פנינה, כרטיסים לבנים וזהב עדין" },
  { id: "parchment-navy" as Theme, name: "קלף ונייבי", description: "קלף בהיר, טקסט נייבי ומסגרות זהב" },
  { id: "midnight-gold" as Theme, name: "לילה כחול וזהב", description: "כחול עמוק, שמנת וזהב מלכותי" },
  { id: "royal-gold" as Theme, name: "זהב מלכותי", description: "נושא יוקרתי בגווני זהב ובורדו" },
  { id: "gold-silver" as Theme, name: "זהב-אפור", description: "נושא אלגנטי בגווני זהב ואפור" },
  { id: "elegant-night" as Theme, name: "לילה אלגנטי", description: "נושא כהה ומתוחכם" },
  { id: "ancient-scroll" as Theme, name: "מגילה עתיקה", description: "נושא בגווני קלף ודיו" },
];

const ChumashThemePreview = ({ preview }: { preview: CustomAppTheme }) => {
  const radius = preview.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius;
  const buttonRadius = preview.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius;
  const borderWidth = preview.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth;
  const shadow = THEME_SHADOWS[preview.shadow ?? DEFAULT_THEME_APPEARANCE.shadow];

  return (
    <div
      data-testid="chumash-theme-preview"
      className="overflow-hidden border text-right"
      style={{
        direction: "rtl",
        background: preview.background,
        color: preview.foreground,
        borderColor: preview.accent,
        borderRadius: radius,
        borderWidth,
        boxShadow: shadow,
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 text-[10px] font-bold"
        style={{
          background: preview.sidebar,
          color: preview.sidebarForeground,
          boxShadow: preview.headerShadow ? shadow : "none",
        }}
      >
        <span style={{ color: preview.accent }}>✦ תורה עם מפרשים</span>
        <span>חומש&nbsp;&nbsp; סידור</span>
      </div>
      <div className="space-y-2.5 p-2.5">
        <div className="text-[10px] font-bold" style={{ color: preview.primary }}>בראשית / בראשית</div>
        <div className="grid grid-cols-3 gap-1.5">
          {["בראשית", "שמות", "ויקרא"].map((book, index) => (
            <div
              key={book}
              className="px-1 py-2 text-center text-[9px] font-bold"
              style={{
                background: index === 0 ? preview.primary : preview.card,
                color: index === 0 ? preview.sidebarForeground : preview.foreground,
                border: `${borderWidth}px solid ${index === 0 ? preview.primary : preview.accent}55`,
                borderRadius: buttonRadius,
              }}
            >
              <div className="mb-0.5 text-xs">▣</div>{book}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-1 text-[8px] font-bold">
          <span style={{ color: preview.accent }}>T</span>
          <span className="flex-1 border px-2 py-1 text-center" style={{ borderColor: preview.accent, borderRadius: buttonRadius }}>
            שאלות ומפרשים
          </span>
          <span style={{ color: preview.accent }}>⛶</span>
        </div>
        <div
          className="p-2.5"
          style={{
            background: preview.card,
            border: `${borderWidth}px solid ${preview.accent}`,
            borderRadius: radius,
            boxShadow: shadow,
          }}
        >
          <div className="mb-2 text-[9px] font-bold" style={{ color: preview.primary }}>פרק א׳ · פסוק א׳</div>
          <p className="text-center font-serif text-[13px] leading-6" style={{ color: preview.foreground }}>
            בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ
          </p>
          <div className="mt-2 flex justify-center gap-1">
            <span className="px-2 py-0.5 text-[8px] font-bold" style={{ background: `${preview.accent}33`, borderRadius: buttonRadius }}>שאלות</span>
            <span className="px-2 py-0.5 text-[8px] font-bold" style={{ background: `${preview.accent}33`, borderRadius: buttonRadius }}>תשובות</span>
          </div>
        </div>
        <div className="text-center text-[9px] font-bold" style={{ color: preview.accent }}>✦ תצוגה מקדימה ✦</div>
      </div>
    </div>
  );
};

const fonts = [
  { value: "David", label: "דוד" },
  { value: "Frank Ruehl Libre", label: "פרנק רוהל" },
  { value: "Miriam Libre", label: "מרים" },
  { value: "Rubik", label: "רוביק" },
  { value: "Heebo", label: "היבו" },
  { value: "Alef", label: "אלף" },
  { value: "Varela Round", label: "וארלה" },
  { value: "Arial", label: "אריאל" },
  { value: "Times New Roman", label: "טיימס" },
];

export const Settings = ({ showTrigger = true }: { showTrigger?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("calendar");
  const [themesOnly, setThemesOnly] = useState(false);
  const [themeEditorTab, setThemeEditorTab] = useState<"presets" | "custom">("presets");
  const [autoWeeklyParsha, setAutoWeeklyParsha] = useState(() => localStorage.getItem("autoWeeklyParsha") !== "false");
  const { theme, setTheme, customTheme, customThemes, publicThemes, saveCustomTheme, selectCustomTheme, publishCustomTheme } = useTheme();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const [customThemeDraft, setCustomThemeDraft] = useState(customTheme);
  const [previewThemeDraft, setPreviewThemeDraft] = useState<CustomAppTheme>(customTheme);
  const [editingCustomThemeId, setEditingCustomThemeId] = useState<string | undefined>();
  const [savingCustomTheme, setSavingCustomTheme] = useState(false);
  const { settings, updateSettings } = useFontAndColorSettings();
  const { displaySettings, updateDisplaySettings } = useDisplayMode();
  const [isIsrael, setIsIsrael] = useState(getCalendarPreference());
  const { settings: notifSettings, updateSettings: updateNotif, addReminder, updateReminder, removeReminder, permission, requestPermission, sendTestNotification, supported: notifSupported } = useNotifications();
  const webPush = useWebPush();
  const { user } = useAuth();
  const [devFloatingEnabled, setDevFloatingEnabled] = useState(() => getDevFeatureEnabled(DEV_FLOATING_ENABLED_KEY, true));
  const [devChatEnabled, setDevChatEnabled] = useState(() => getDevFeatureEnabled(DEV_CHAT_ENABLED_KEY, true));
  const [debugRendersEnabled, setDebugRendersEnabled] = useState(() => {
    try { return localStorage.getItem(DEBUG_RENDERS_KEY) === "1"; } catch { return false; }
  });

  const handleDebugRendersToggle = (checked: boolean) => {
    setDebugRendersEnabled(checked);
    try {
      if (checked) localStorage.setItem(DEBUG_RENDERS_KEY, "1");
      else localStorage.removeItem(DEBUG_RENDERS_KEY);
    } catch { /* ignore */ }
    toast.success(checked
      ? "דיבאג רינדורים + CLS הופעל. רענן את הדף כדי להתחיל לראות לוגים בקונסול."
      : "דיבאג רינדורים כובה. רענן את הדף.");
  };
  const [devScreenshotEnabled, setDevScreenshotEnabled] = useState(() => getDevFeatureEnabled(DEV_SCREENSHOT_ENABLED_KEY, true));
  const [devLayoutEditorEnabled, setDevLayoutEditorEnabled] = useState(() => getDevFeatureEnabled(DEV_LAYOUT_EDITOR_ENABLED_KEY, false));
  const [devChumashTraceEnabled, setDevChumashTraceEnabled] = useState(() => getDevFeatureEnabled(DEV_CHUMASH_TRACE_KEY, false));
  const [apiKeys, setApiKeys] = useState<ApiKeys>(loadLocalApiKeys);

  useEffect(() => {
    const openSettings = (event: Event) => {
      const requestedTab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
      setThemesOnly(requestedTab === "themes");
      setActiveTab(requestedTab || "calendar");
      setOpen(true);
    };
    const openThemes = () => {
      delete document.documentElement.dataset.openAppThemes;
      setThemesOnly(true);
      setActiveTab("themes");
      setThemeEditorTab("presets");
      setOpen(true);
    };
    window.addEventListener("open-app-settings", openSettings);
    window.addEventListener("open-app-themes", openThemes);
    if (document.documentElement.dataset.openAppThemes === "true") openThemes();
    return () => {
      window.removeEventListener("open-app-settings", openSettings);
      window.removeEventListener("open-app-themes", openThemes);
    };
  }, []);

  useEffect(() => {
    setCustomThemeDraft(customTheme);
    setPreviewThemeDraft(customTheme);
  }, [customTheme]);

  const readBuiltInTheme = (themeId: Theme, name: string) => {
    const probe = document.createElement("div");
    probe.className = themeId;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    const toHex = (property: string, fallback: string) => {
      const value = style.getPropertyValue(property).trim();
      const match = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
      if (!match) return fallback;
      const h = Number(match[1]), s = Number(match[2]) / 100, l = Number(match[3]) / 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      return `#${[f(0), f(8), f(4)].map(v => Math.round(255 * v).toString(16).padStart(2, "0")).join("")}`;
    };
    const next = {
      name, background: toHex("--background", customTheme.background), foreground: toHex("--foreground", customTheme.foreground),
      card: toHex("--card", customTheme.card), primary: toHex("--primary", customTheme.primary), accent: toHex("--accent", customTheme.accent),
      sidebar: toHex("--sidebar-background", customTheme.sidebar), sidebarForeground: toHex("--sidebar-foreground", customTheme.sidebarForeground),
      cornerRadius: Number.parseInt(style.getPropertyValue("--radius"), 10) || DEFAULT_THEME_APPEARANCE.cornerRadius,
      buttonRadius: customTheme.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
      borderWidth: customTheme.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
      shadow: customTheme.shadow ?? DEFAULT_THEME_APPEARANCE.shadow,
      headerShadow: customTheme.headerShadow ?? DEFAULT_THEME_APPEARANCE.headerShadow,
    };
    probe.remove();
    setEditingCustomThemeId(undefined);
    setCustomThemeDraft(next);
    setPreviewThemeDraft(next);
    return next;
  };

  const handleSaveCustomTheme = async (duplicate = false) => {
    if (!customThemeDraft.name.trim()) {
      toast.error("יש להזין שם לערכת הנושא");
      return;
    }
    setSavingCustomTheme(true);
    try {
      const requestedName = customThemeDraft.name.trim();
      const usedNames = new Set(customThemes.map(item => item.name));
      let duplicateName = requestedName;
      if (duplicate && usedNames.has(duplicateName)) {
        let copyNumber = 2;
        duplicateName = `${requestedName} – עותק`;
        while (usedNames.has(duplicateName)) duplicateName = `${requestedName} – עותק ${copyNumber++}`;
      }
      const next = { ...customThemeDraft, name: duplicate ? duplicateName : requestedName };
      const saved = await saveCustomTheme(next, { id: editingCustomThemeId, duplicate });
      setEditingCustomThemeId(saved.id);
      setCustomThemeDraft(next);
      setTheme("custom");
      toast.success(user ? "ערכת הנושא והבחירה נשמרו במכשיר ובענן" : "ערכת הנושא נשמרה במכשיר");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שמירת ערכת הנושא נכשלה");
    } finally {
      setSavingCustomTheme(false);
    }
  };

  const handlePublishCustomTheme = async () => {
    if (rolesLoading) {
      toast.info("בודק הרשאת מנהל, נסה שוב בעוד רגע");
      return;
    }
    if (!isAdmin) {
      toast.error("רק מנהל יכול לפרסם ערכת נושא לכל המשתמשים");
      return;
    }
    if (!customThemeDraft.name.trim()) {
      toast.error("יש להזין שם לערכת הנושא");
      return;
    }
    setSavingCustomTheme(true);
    try {
      await publishCustomTheme({ ...customThemeDraft, name: customThemeDraft.name.trim() });
      setTheme("custom");
      toast.success("ערכת הנושא פורסמה לכל המשתמשים");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "פרסום ערכת הנושא נכשל");
    } finally {
      setSavingCustomTheme(false);
    }
  };

  // Load API keys from cloud on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('user_settings')
        .select('api_keys')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.api_keys && typeof data.api_keys === 'object') {
        const cloud = data.api_keys as ApiKeys;
        // Merge cloud → local (cloud wins)
        for (const [k, v] of Object.entries(cloud)) {
          if (v) {
            localStorage.setItem(k, v);
          }
        }
        setApiKeys({ ...loadLocalApiKeys(), ...cloud });
      }
    })();
  }, [user]);

  const handleApiKeyChange = useCallback((key: string, value: string) => {
    saveApiKeyLocal(key, value);
    setApiKeys(prev => ({ ...prev, [key]: value || undefined }));
    // Debounced cloud save
    if (user) {
      const allKeys = { ...loadLocalApiKeys(), [key]: value || undefined };
      // Remove empty keys
      const cleaned: ApiKeys = {};
      for (const [k, v] of Object.entries(allKeys)) {
        if (v) cleaned[k] = v;
      }
      (supabase as any)
        .from('user_settings')
        .update({ api_keys: cleaned })
        .eq('user_id', user.id)
        .then(() => {});
    }
  }, [user]);


  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata ?? {};
    const pushUpdates: Record<string, unknown> = {};

    // dev_floating_enabled
    const floatingPush = (() => {
      const cloudVal = meta.dev_floating_enabled;
      const cloudTs = meta.dev_floating_enabled_ts ?? 0;
      const localTs = (() => { try { return Number(localStorage.getItem(DEV_FLOATING_ENABLED_KEY + '-ts')) || 0; } catch { return 0; } })();
      if (cloudVal !== true && cloudVal !== false) return;
      if (cloudTs >= localTs) {
        setDevFloatingEnabled(cloudVal);
        localStorage.setItem(DEV_FLOATING_ENABLED_KEY, String(cloudVal));
        localStorage.setItem(DEV_FLOATING_ENABLED_KEY + '-ts', String(cloudTs));
        window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
      } else {
        const local = getDevFeatureEnabled(DEV_FLOATING_ENABLED_KEY, true);
        Object.assign(pushUpdates, { dev_floating_enabled: local, dev_floating_enabled_ts: localTs });
      }
    })();

    // dev_chat_enabled
    (() => {
      const cloudVal = meta.dev_chat_enabled;
      const cloudTs = meta.dev_chat_enabled_ts ?? 0;
      const localTs = (() => { try { return Number(localStorage.getItem(DEV_CHAT_ENABLED_KEY + '-ts')) || 0; } catch { return 0; } })();
      if (cloudVal !== true && cloudVal !== false) return;
      if (cloudTs >= localTs) {
        setDevChatEnabled(cloudVal);
        localStorage.setItem(DEV_CHAT_ENABLED_KEY, String(cloudVal));
        localStorage.setItem(DEV_CHAT_ENABLED_KEY + '-ts', String(cloudTs));
        window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
      } else {
        const local = getDevFeatureEnabled(DEV_CHAT_ENABLED_KEY, true);
        Object.assign(pushUpdates, { dev_chat_enabled: local, dev_chat_enabled_ts: localTs });
      }
    })();

    // dev_screenshot_enabled
    (() => {
      const cloudVal = meta.dev_screenshot_enabled;
      const cloudTs = meta.dev_screenshot_enabled_ts ?? 0;
      const localTs = (() => { try { return Number(localStorage.getItem(DEV_SCREENSHOT_ENABLED_KEY + '-ts')) || 0; } catch { return 0; } })();
      if (cloudVal !== true && cloudVal !== false) return;
      if (cloudTs >= localTs) {
        setDevScreenshotEnabled(cloudVal);
        localStorage.setItem(DEV_SCREENSHOT_ENABLED_KEY, String(cloudVal));
        localStorage.setItem(DEV_SCREENSHOT_ENABLED_KEY + '-ts', String(cloudTs));
        window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
      } else {
        const local = getDevFeatureEnabled(DEV_SCREENSHOT_ENABLED_KEY, true);
        Object.assign(pushUpdates, { dev_screenshot_enabled: local, dev_screenshot_enabled_ts: localTs });
      }
    })();

    // dev_layout_editor_enabled
    (() => {
      const cloudVal = meta.dev_layout_editor_enabled;
      const cloudTs = meta.dev_layout_editor_enabled_ts ?? 0;
      const localTs = (() => { try { return Number(localStorage.getItem(DEV_LAYOUT_EDITOR_ENABLED_KEY + '-ts')) || 0; } catch { return 0; } })();
      if (cloudVal !== true && cloudVal !== false) return;
      if (cloudTs >= localTs) {
        setDevLayoutEditorEnabled(cloudVal);
        localStorage.setItem(DEV_LAYOUT_EDITOR_ENABLED_KEY, String(cloudVal));
        localStorage.setItem(DEV_LAYOUT_EDITOR_ENABLED_KEY + '-ts', String(cloudTs));
        window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
      } else {
        const local = getDevFeatureEnabled(DEV_LAYOUT_EDITOR_ENABLED_KEY, false);
        Object.assign(pushUpdates, { dev_layout_editor_enabled: local, dev_layout_editor_enabled_ts: localTs });
      }
    })();

    if (Object.keys(pushUpdates).length > 0) {
      supabase.auth.updateUser({ data: { ...meta, ...pushUpdates } }).catch(() => {});
    }
  }, [user]);

  const resetTextSizesToDefault = () => {
    updateSettings({
      pasukSize: 18,
      titleSize: 16,
      questionSize: 16,
      answerSize: 14,
      commentarySize: 18,
      fontScale: 1,
    });
    toast.success("גדלי הטקסט אופסו לברירת המחדל");
  };

  const handleCalendarChange = (checked: boolean) => {
    setIsIsrael(checked);
    setCalendarPreference(checked);
  };

  const hasReminders = notifSettings.reminders.length > 0;
  const allRemindersEnabled = hasReminders && notifSettings.reminders.every((r) => r.enabled);
  const allPopupsEnabled = hasReminders && notifSettings.reminders.every((r) => r.popup);
  const allSoundsEnabled = hasReminders && notifSettings.reminders.every((r) => r.sound);

  const updateAllReminders = useCallback((partial: { enabled?: boolean; popup?: boolean; sound?: boolean }) => {
    for (const reminder of notifSettings.reminders) {
      updateReminder(reminder.id, partial);
    }
  }, [notifSettings.reminders, updateReminder]);

  const handleDevChatToggle = (checked: boolean) => {
    const now = Date.now();
    setDevChatEnabled(checked);
    localStorage.setItem(DEV_CHAT_ENABLED_KEY, String(checked));
    localStorage.setItem(DEV_CHAT_ENABLED_KEY + '-ts', String(now));
    window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
    toast.success(checked ? "צ'אט פיתוח הופעל" : "צ'אט פיתוח כובה");
    if (user) {
      supabase.auth.updateUser({ data: { ...user.user_metadata, dev_chat_enabled: checked, dev_chat_enabled_ts: now } })
        .catch(() => {});
    }
  };

  const handleDevScreenshotToggle = (checked: boolean) => {
    const now = Date.now();
    setDevScreenshotEnabled(checked);
    localStorage.setItem(DEV_SCREENSHOT_ENABLED_KEY, String(checked));
    localStorage.setItem(DEV_SCREENSHOT_ENABLED_KEY + '-ts', String(now));
    window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
    toast.success(checked ? "צילום מסך פיתוח הופעל" : "צילום מסך פיתוח כובה");
    if (user) {
      supabase.auth.updateUser({ data: { ...user.user_metadata, dev_screenshot_enabled: checked, dev_screenshot_enabled_ts: now } })
        .catch(() => {});
    }
  };

  const handleDevFloatingToggle = (checked: boolean) => {
    const now = Date.now();
    setDevFloatingEnabled(checked);
    localStorage.setItem(DEV_FLOATING_ENABLED_KEY, String(checked));
    localStorage.setItem(DEV_FLOATING_ENABLED_KEY + '-ts', String(now));
    window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
    toast.success(checked ? "כל כפתורי הפיתוח הופעלו" : "כל כפתורי הפיתוח כובו");
    if (user) {
      supabase.auth.updateUser({ data: { ...user.user_metadata, dev_floating_enabled: checked, dev_floating_enabled_ts: now } })
        .catch(() => {});
    }
  };

  const handleDevLayoutEditorToggle = (checked: boolean) => {
    const now = Date.now();
    setDevLayoutEditorEnabled(checked);
    localStorage.setItem(DEV_LAYOUT_EDITOR_ENABLED_KEY, String(checked));
    localStorage.setItem(DEV_LAYOUT_EDITOR_ENABLED_KEY + '-ts', String(now));
    window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
    toast.success(checked ? "אייקון עריכת פריסה הופעל" : "אייקון עריכת פריסה כובה");
    if (user) {
      supabase.auth.updateUser({ data: { ...user.user_metadata, dev_layout_editor_enabled: checked, dev_layout_editor_enabled_ts: now } })
        .catch(() => {});
    }
  };

  const handleDevChumashTraceToggle = (checked: boolean) => {
    setDevChumashTraceEnabled(checked);
    try {
      localStorage.setItem(DEV_CHUMASH_TRACE_KEY, String(checked));
      (window as Window & { __CHUMASH_TRACE__?: boolean }).__CHUMASH_TRACE__ = checked;
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent(DEV_FEATURES_EVENT));
    toast.success(checked ? "Trace חומש הופעל" : "Trace חומש כובה");
  };

  const renderApiService = (name: string, description: string, fields: { key: string; label: string; placeholder: string; type: string }[]) => {
    const hasAnyKey = fields.some(f => !!apiKeys[f.key]);
    return (
      <div className="p-4 rounded-lg border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${hasAnyKey ? 'bg-primary' : 'bg-muted-foreground'}`} />
            <span className={`text-xs ${hasAnyKey ? 'text-primary' : 'text-muted-foreground'}`}>
              {hasAnyKey ? 'מחובר ☁️' : 'לא מחובר'}
            </span>
          </div>
          <h4 className="font-semibold">{name}</h4>
        </div>
        <p className="text-sm text-muted-foreground text-right">{description}</p>
        {fields.map(f => (
          <div key={f.key} className="space-y-2">
            <Label className="text-sm">{f.label}</Label>
            <Input
              type={f.type}
              placeholder={f.placeholder}
              dir="ltr"
              className="font-mono text-sm"
              value={apiKeys[f.key] || ''}
              onChange={(e) => handleApiKeyChange(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={!themesOnly}>
      {showTrigger && <DialogTrigger asChild>
        <Button 
          data-settings-trigger
          data-layout="floating-settings" data-layout-label="⚙️ הגדרות צפות"
          size="icon"
          onClick={() => { setThemesOnly(false); setActiveTab("calendar"); }}
          className="fixed bottom-4 right-4 z-40 hidden h-14 w-14 rounded-full bg-primary shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl md:inline-flex sm:bottom-6 sm:right-6"
          style={{ bottom: 'max(calc(1rem + var(--safe-area-inset-bottom, var(--sai-bottom, env(safe-area-inset-bottom, 0px)))), 4rem)' }}
        >
          <SettingsIcon className="h-5 w-5" />
        </Button>
      </DialogTrigger>}
      <DialogContent
        hideOverlay={themesOnly}
        data-layout="dialog-settings"
        data-layout-label="📦 דיאלוג: הגדרות"
        data-theme-panel={themesOnly ? "chumash" : undefined}
        className={themesOnly
          ? "!fixed !inset-0 !z-[1000] !flex !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-[#d5aa4547] bg-[#101b35] p-0 text-right text-slate-50 shadow-2xl sm:!inset-x-auto sm:!bottom-auto sm:!left-auto sm:!right-4 sm:!top-16 sm:!h-[min(88dvh,760px)] sm:!max-h-[calc(100dvh-5rem)] sm:!w-[628px] sm:rounded-xl [&>button]:hidden"
          : "w-[95vw] sm:max-w-[650px] max-h-[85vh] overflow-y-auto text-right"}
      >
        <DialogHeader>
          {themesOnly ? (
           <div className="relative z-10 flex shrink-0 flex-col items-stretch justify-between gap-2 border-b border-[#d5aa4547] bg-[#101b35] px-3 pb-2.5 pt-[max(0.625rem,var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] sm:flex-row sm:items-center sm:px-4 sm:py-2.5" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#d5aa45]" style={{ fontFamily: "'Noto Serif Hebrew', serif" }}>✦ ערכת נושא</span>
              <span className="rounded-full bg-[#d5aa4529] px-1.5 py-0.5 text-[9px] text-[#d5aa45]">תצוגה חיה בדף</span>
            </div>
            <div className="flex items-center justify-between gap-1 sm:justify-start">
              <button
                type="button"
                onClick={() => setThemeEditorTab("presets")}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                style={{ background: themeEditorTab === "presets" ? "#d5aa45" : "rgba(255,255,255,0.07)", color: themeEditorTab === "presets" ? "#101827" : "#f8fafc" }}
              >בחירת ערכה</button>
              <button
                type="button"
                onClick={() => setThemeEditorTab("custom")}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                style={{ background: themeEditorTab === "custom" ? "#d5aa45" : "rgba(255,255,255,0.07)", color: themeEditorTab === "custom" ? "#101827" : "#f8fafc" }}
              >עריכה מותאמת</button>
              <button type="button" onClick={() => setOpen(false)} className="mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-sm text-white" title="סגור">✕</button>
            </div>
          </div>
          ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs text-[#C8A44D] font-mono">v{__APP_VERSION__}</span>
            <DialogTitle className="text-right text-xl sm:text-2xl flex items-center justify-end gap-2">
              <span>{themesOnly ? "ערכות נושא" : "הגדרות"}</span>
              {themesOnly ? <Palette className="h-5 w-5 sm:h-6 sm:w-6" /> : <SettingsIcon className="h-5 w-5 sm:h-6 sm:w-6" />}
            </DialogTitle>
          </div>
          )}
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className={themesOnly ? "flex min-h-0 w-full flex-1 flex-col" : "w-full"} dir="rtl">
          {!themesOnly && <TabsList className="flex flex-wrap justify-center h-auto mb-4 sm:mb-6 gap-0.5 sm:gap-1 p-1">
            <TabsTrigger value="calendar" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">לוח</span>
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">תזכורות</span>
              <Bell className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="fonts" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">גופן</span>
              <Type className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="display" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">תצוגה</span>
              <Layout className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="sefaria" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">אחסון</span>
              <HardDrive className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">נתונים</span>
              <Database className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
              <span className="truncate">API</span>
              <Plug className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </TabsTrigger>
            {import.meta.env.DEV && (
              <TabsTrigger value="dev" className="gap-0.5 sm:gap-1 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
                <span className="truncate">פיתוח</span>
                <Code className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              </TabsTrigger>
            )}
          </TabsList>}

          <TabsContent value="calendar" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">הגדרות לוח עברי</h3>
                  <p className="text-sm text-muted-foreground">
                    בחר את סוג הלוח לחישוב פרשת השבוע
                  </p>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex-1 text-right">
                      <Label htmlFor="calendar-toggle" className="text-base font-semibold cursor-pointer">
                        {isIsrael ? 'לוח ישראל' : 'לוח חוץ לארץ'}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isIsrael 
                          ? 'מחשב פרשת שבוע לפי לוח ישראל (חגים בין תפוצות מתקיימים יום אחד)'
                          : 'מחשב פרשת שבוע לפי לוח חוץ לארץ (חגים בין תפוצות מתקיימים שני ימים)'}
                      </p>
                    </div>
                    <Switch
                      id="calendar-toggle"
                      checked={isIsrael}
                      onCheckedChange={handleCalendarChange}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex-1 text-right">
                      <Label htmlFor="auto-weekly-parsha" className="text-base font-semibold cursor-pointer">
                        פרשת השבוע אוטומטית
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        טוען אוטומטית את פרשת השבוע בפתיחת האפליקציה
                      </p>
                    </div>
                    <Switch
                      id="auto-weekly-parsha"
                      checked={autoWeeklyParsha}
                      onCheckedChange={(checked) => {
                        setAutoWeeklyParsha(checked);
                        localStorage.setItem("autoWeeklyParsha", String(checked));
                        window.dispatchEvent(new CustomEvent("auto-weekly-parsha-changed", { detail: { enabled: checked } }));
                        toast.success(checked ? "פרשת השבוע תיטען אוטומטית" : "פרשת השבוע לא תיטען אוטומטית");
                      }}
                    />
                  </div>

                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Calendar className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="space-y-1 text-right">
                        <p className="text-sm font-medium">
                          השינוי ישפיע על פרשת השבוע שתיטען בפתיחה הבאה של האפליקציה
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ההבדל בין הלוחות מתבטא בעיקר בתקופות שבהן חגים משפיעים על מחזור הפרשות
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ── NOTIFICATION SETTINGS ─────────────────────────────── */}

          <TabsContent value="notifications" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => addReminder()}>
                    <Plus className="h-4 w-4" />
                    הוסף תזכורת
                  </Button>
                  <div className="text-right">
                    <h3 className="font-semibold text-lg flex items-center gap-2 justify-end">
                      <span>תזכורות לימוד</span>
                      <Bell className="h-5 w-5 text-primary" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      הגדר תזכורות מרובות בשעות שונות
                    </p>
                  </div>
                </div>

                <Separator />

                {!notifSupported && (
                  <div className="p-4 bg-destructive/10 rounded-lg text-right text-sm text-destructive">
                    הדפדפן שלך אינו תומך בהתראות. זמין בעת שימוש באפליקציה המותקנת (PWA).
                  </div>
                )}

                {notifSupported && (
                  <div className="space-y-4">
                    {/* Permission */}
                    {permission !== "granted" && (
                      <div className="p-4 bg-accent/20 rounded-lg text-right space-y-2">
                        <p className="text-sm font-medium">יש לאשר גישה להתראות</p>
                        <Button size="sm" onClick={requestPermission}>
                          <Bell className="h-4 w-4 ml-2" />
                          אפשר התראות
                        </Button>
                        {permission === "denied" && (
                          <p className="text-xs text-destructive">הגישה נדחתה בהגדרות הדפדפן</p>
                        )}
                      </div>
                    )}

                    {/* Global toggles */}
                    {hasReminders && (
                      <div className="p-4 rounded-lg border bg-card/50 space-y-4">
                        <div className="text-right space-y-1">
                          <p className="text-sm font-semibold">שליטה מהירה על כל ההתראות</p>
                          <p className="text-xs text-muted-foreground">כאן אפשר להדליק/לכבות בבת אחת את כל התזכורות, הפופאפ והצליל</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <Switch
                            checked={allRemindersEnabled}
                            onCheckedChange={(v) => updateAllReminders({ enabled: v })}
                          />
                          <span className="text-sm text-right">כל התזכורות פעילות</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <Switch
                            checked={allPopupsEnabled}
                            onCheckedChange={(v) => updateAllReminders({ popup: v })}
                          />
                          <span className="text-sm text-right">כל הפופאפים באפליקציה</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <Switch
                            checked={allSoundsEnabled}
                            onCheckedChange={(v) => updateAllReminders({ sound: v })}
                          />
                          <span className="text-sm text-right">כל הצלילים פעילים</span>
                        </div>
                      </div>
                    )}

                    {/* Reminders list */}
                    {notifSettings.reminders.length === 0 && (
                      <div className="p-6 text-center text-muted-foreground text-sm border rounded-lg border-dashed">
                        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>אין תזכורות מוגדרות</p>
                        <p className="text-xs mt-1">לחץ "הוסף תזכורת" כדי להתחיל</p>
                      </div>
                    )}

                    {notifSettings.reminders.map((reminder) => (
                      <div key={reminder.id} className="p-4 rounded-lg border space-y-3 bg-card">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeReminder(reminder.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={reminder.enabled}
                              onCheckedChange={(v) => updateReminder(reminder.id, { enabled: v })}
                            />
                            <div className="text-right">
                              <span className="font-semibold text-sm">{reminder.label}</span>
                              <div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
                                <span>{String(reminder.hour).padStart(2, "0")}:{String(reminder.minute).padStart(2, "0")}</span>
                                <Clock className="h-3 w-3" />
                              </div>
                            </div>
                            {reminder.enabled ? (
                              <Bell className="h-4 w-4 text-primary" />
                            ) : (
                              <BellOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Label */}
                        <div className="space-y-1 text-right">
                          <Label className="text-xs text-muted-foreground">שם התזכורת</Label>
                          <Input
                            value={reminder.label}
                            onChange={(e) => updateReminder(reminder.id, { label: e.target.value })}
                            className="text-right text-sm h-8"
                            dir="rtl"
                          />
                        </div>

                        {/* Time */}
                        <div className="flex items-center gap-2 justify-end">
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <Input
                              type="number"
                              min={0} max={23}
                              value={String(reminder.hour).padStart(2, "0")}
                              onChange={(e) => updateReminder(reminder.id, { hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                              className="w-14 text-center text-sm h-8"
                            />
                            <span className="font-mono font-bold text-lg">:</span>
                            <Input
                              type="number"
                              min={0} max={59}
                              value={String(reminder.minute).padStart(2, "0")}
                              onChange={(e) => updateReminder(reminder.id, { minute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                              className="w-14 text-center text-sm h-8"
                            />
                          </div>
                        </div>

                        {/* Message */}
                        <div className="space-y-1 text-right">
                          <Label className="text-xs text-muted-foreground">הודעה</Label>
                          <Input
                            value={reminder.message}
                            onChange={(e) => updateReminder(reminder.id, { message: e.target.value })}
                            className="text-right text-sm h-8"
                            dir="rtl"
                          />
                        </div>

                        {/* Days picker */}
                        <div className="space-y-1 text-right">
                          <Label className="text-xs text-muted-foreground">ימים (ריק = כל יום)</Label>
                          <div className="flex gap-1 justify-end flex-wrap">
                            {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((dayLabel, idx) => {
                              const active = reminder.days.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    const days = active
                                      ? reminder.days.filter((d) => d !== idx)
                                      : [...reminder.days, idx];
                                    updateReminder(reminder.id, { days });
                                  }}
                                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-accent"
                                  }`}
                                >
                                  {dayLabel}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Popup toggle */}
                        <div className="flex items-center justify-between">
                          <Switch
                            checked={reminder.popup}
                            onCheckedChange={(v) => updateReminder(reminder.id, { popup: v })}
                          />
                          <span className="text-sm text-right">הצג פופ-אפ באפליקציה</span>
                        </div>

                        {/* Sound toggle */}
                        <div className="flex items-center justify-between">
                          <Switch
                            checked={reminder.sound}
                            onCheckedChange={(v) => updateReminder(reminder.id, { sound: v })}
                          />
                          <span className="text-sm text-right flex items-center gap-1.5">
                            <span>{reminder.sound ? "צליל פעיל" : "צליל כבוי"}</span>
                            {reminder.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Test button */}
                    {permission === "granted" && notifSettings.reminders.length > 0 && (
                      <Button variant="outline" size="sm" className="w-full gap-2" onClick={sendTestNotification}>
                        <Bell className="h-4 w-4" />
                        שלח התראה לדוגמא
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* ── WEB PUSH (background notifications) ── */}
            {webPush.isSupported && (
              <Card className="p-6">
                <div className="space-y-4">
                  <div className="text-right">
                    <h3 className="font-semibold text-lg flex items-center gap-2 justify-end">
                      <span>התראות Push ברקע</span>
                      <Bell className="h-5 w-5 text-primary" />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      קבל התראות גם כשהדפדפן סגור. ההתראות נשלחות מהשרת בזמן שהגדרת.
                    </p>
                  </div>

                  <Separator />

                  {webPush.state === "denied" && (
                    <div className="p-3 bg-destructive/10 rounded-lg text-right text-sm text-destructive">
                      גישה להתראות Push נחסמה בהגדרות הדפדפן. יש לאפשר אותן שם כדי לקבל התראות ברקע.
                    </div>
                  )}

                  {webPush.state === "subscribed" ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          disabled={webPush.loading}
                          onClick={() => webPush.unsubscribe()}
                        >
                          בטל הרשמה
                        </Button>
                        <div className="flex items-center gap-2 text-right">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">Push פעיל</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        disabled={webPush.loading}
                        onClick={async () => {
                          // Sync current reminders to push server
                          const pushReminders = notifSettings.reminders
                            .filter(r => r.enabled)
                            .map(r => ({
                              id: r.id,
                              enabled: true,
                              hour: r.hour,
                              minute: r.minute,
                              message: r.message,
                              type: "daily" as const,
                              days: r.days,
                            }));
                          await webPush.syncReminders(pushReminders);
                          toast.success("תזכורות Push עודכנו בשרת");
                        }}
                      >
                        <Bell className="h-4 w-4" />
                        סנכרן תזכורות לשרת
                      </Button>

                      <p className="text-xs text-muted-foreground text-right">
                        לחץ "סנכרן" אחרי כל שינוי בתזכורות כדי שגם התראות הרקע יתעדכנו.
                      </p>
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-2"
                      disabled={webPush.loading || webPush.state === "denied"}
                      onClick={async () => {
                        const pushReminders = notifSettings.reminders
                          .filter(r => r.enabled)
                          .map(r => ({
                            id: r.id,
                            enabled: true,
                            hour: r.hour,
                            minute: r.minute,
                            message: r.message,
                            type: "daily" as const,
                            days: r.days,
                          }));
                        const sub = await webPush.subscribe(pushReminders);
                        if (sub) toast.success("התראות Push הופעלו! תקבל הודעות גם כשהדפדפן סגור.");
                        else toast.error("לא הצלחנו להירשם ל-Push. בדוק שאישרת התראות.");
                      }}
                    >
                      <Bell className="h-4 w-4" />
                      {webPush.loading ? "מפעיל..." : "הפעל התראות Push ברקע"}
                    </Button>
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="themes" className={themesOnly ? "m-0 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]" : "space-y-4"}>
            <div className="grid min-h-0 items-start gap-0 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="min-w-0 space-y-4">
            {(!themesOnly || themeEditorTab === "presets") && (
            <>
            <RadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)} className={themesOnly ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : undefined}>
              {themes.map((t) => (
                <Card
                  key={t.id}
                  className={`${themesOnly ? "relative border-[#d5aa4547] bg-white/[0.07] p-2 text-slate-50 hover:scale-[1.03]" : "p-4 hover:shadow-md"} cursor-pointer transition-all ${
                    theme === t.id ? (themesOnly ? "ring-1 ring-[#d5aa45]" : "ring-2 ring-primary shadow-lg") : ""
                  }`}
                  onClick={() => {
                    setTheme(t.id);
                    readBuiltInTheme(t.id, t.name);
                  }}
                >
                  <div className={themesOnly ? "flex flex-col items-center gap-1.5 text-center" : "flex items-center gap-3"}>
                    <RadioGroupItem value={t.id} id={t.id} className={themesOnly ? "sr-only" : undefined} />
                    {themesOnly && (
                      <div
                        data-theme-swatch={t.id}
                        className={`${t.id} h-10 w-10 overflow-hidden rounded-lg border`}
                        style={{ borderColor: "hsl(var(--accent))", background: "hsl(var(--background))" }}
                      >
                        <div className="h-4" style={{ background: "hsl(var(--sidebar-background))" }} />
                        <div className="flex h-3 items-center justify-center" style={{ background: "hsl(var(--card))" }}>
                          <span className="text-[7px]" style={{ color: "hsl(var(--foreground))" }}>אבג</span>
                        </div>
                        <div className="h-3" style={{ background: "hsl(var(--primary))" }} />
                      </div>
                    )}
                    <div className="flex-1 text-right">
                      <Label htmlFor={t.id} className={themesOnly ? "cursor-pointer text-[11px] font-semibold text-slate-50 sm:text-[10px]" : "text-base font-semibold cursor-pointer"}>
                        {t.name}
                      </Label>
                      {!themesOnly && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                    </div>
                    <Button type="button" size="sm" variant="outline" className={themesOnly ? "relative z-10 h-6 gap-1 border-[#d5aa4547] bg-[#172544] px-2 text-[9px] text-[#d5aa45]" : "h-8 gap-1"} onClick={(event) => { event.stopPropagation(); readBuiltInTheme(t.id, t.name); setThemeEditorTab("custom"); }}>
                      <Pencil className="h-3.5 w-3.5" /> ערוך
                    </Button>
                  </div>
                </Card>
              ))}
            </RadioGroup>
            {customThemes.length > 0 && (
              <Card className="space-y-2 p-3" dir="rtl">
                <h3 className="text-right text-sm font-bold">הערכות שלי — נשמרות בענן</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {customThemes.map(saved => (
                    <div key={saved.id} className={`flex items-center gap-2 rounded-xl border p-2 ${editingCustomThemeId === saved.id ? "ring-2 ring-primary" : ""}`}>
                      <button className="flex flex-1 items-center gap-2 text-right" onClick={async () => { await selectCustomTheme(saved.id); toast.success("הערכה נבחרה וסונכרנה"); }}>
                        <span className="h-8 w-8 rounded-lg border" style={{ background: saved.background, borderColor: saved.accent }} />
                        <span className="font-semibold">{saved.name}</span>
                      </button>
                      <Button size="icon" variant="ghost" title="ערוך ערכה" onClick={() => { const { id, updatedAt, ...draft } = saved; setEditingCustomThemeId(id); setCustomThemeDraft(draft); setPreviewThemeDraft(draft); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {publicThemes.length > 0 && (
              <Card className="space-y-2 p-3" dir="rtl">
                <h3 className="text-right text-sm font-bold">ערכות שפורסמו לכל המשתמשים</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {publicThemes.map(saved => (
                    <div key={saved.id} className="flex items-center gap-2 rounded-xl border p-2">
                      <button className="flex flex-1 items-center gap-2 text-right" onClick={async () => { await selectCustomTheme(saved.id); toast.success("הערכה הציבורית נבחרה וסונכרנה"); }}>
                        <span className="h-8 w-8 rounded-lg border" style={{ background: saved.background, borderColor: saved.accent }} />
                        <span className="font-semibold">{saved.name}</span>
                      </button>
                      <Button size="icon" variant="ghost" title="ערוך כעותק חדש" onClick={() => { const { id: _id, updatedAt: _updatedAt, ...draft } = saved; setEditingCustomThemeId(undefined); setCustomThemeDraft(draft); setPreviewThemeDraft(draft); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            </>
            )}
            {(!themesOnly || themeEditorTab === "custom") && (
            <Card className="overflow-hidden border-slate-600 bg-slate-950 text-slate-50" dir="rtl">
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Palette className="h-5 w-5 text-amber-400" />
                  <div className="flex-1 text-right">
                    <h3 className="font-bold text-white">עריכת ערכת נושא</h3>
                    <p className="text-xs text-slate-300">תצוגה חיה · נשמר במכשיר ובחשבון המחובר</p>
                  </div>
                </div>
                <Input
                  value={customThemeDraft.name}
                  onChange={e => {
                    const name = e.target.value;
                    setCustomThemeDraft(prev => ({ ...prev, name }));
                    setPreviewThemeDraft(prev => ({ ...prev, name }));
                  }}
                  placeholder="שם הערכה"
                  className="border-slate-600 bg-slate-900 text-white placeholder:text-slate-400"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {([
                    ["background", "רקע"], ["foreground", "טקסט"], ["card", "כרטיסים"],
                    ["primary", "צבע ראשי"], ["accent", "הדגשה"], ["sidebar", "כותרת עליונה"],
                    ["sidebarForeground", "טקסט בכותרת"],
                  ] as const).map(([key, label]) => (
                    <ColorPicker
                      key={key}
                      compact
                      label={label}
                      value={customThemeDraft[key]}
                      onChange={color => {
                        setCustomThemeDraft(prev => ({ ...prev, [key]: color }));
                        setPreviewThemeDraft(prev => ({ ...prev, [key]: color }));
                      }}
                    />
                  ))}
                </div>
                <ThemeAppearanceControls
                  value={{
                    cornerRadius: customThemeDraft.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
                    buttonRadius: customThemeDraft.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
                    borderWidth: customThemeDraft.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
                    shadow: customThemeDraft.shadow ?? DEFAULT_THEME_APPEARANCE.shadow,
                    headerShadow: customThemeDraft.headerShadow ?? DEFAULT_THEME_APPEARANCE.headerShadow,
                  }}
                  onChange={appearance => {
                    setCustomThemeDraft(prev => ({ ...prev, ...appearance }));
                    setPreviewThemeDraft(prev => ({ ...prev, ...appearance }));
                  }}
                />
                <div
                  className="border border-slate-600 p-3"
                  style={{
                    background: customThemeDraft.background,
                    color: customThemeDraft.foreground,
                    borderRadius: customThemeDraft.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
                    borderWidth: customThemeDraft.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
                    boxShadow: THEME_SHADOWS[customThemeDraft.shadow ?? DEFAULT_THEME_APPEARANCE.shadow],
                  }}
                >
                  <div
                    className="mb-2 p-2 text-center font-bold"
                    style={{
                      background: customThemeDraft.sidebar,
                      color: customThemeDraft.sidebarForeground,
                      borderRadius: customThemeDraft.buttonRadius ?? DEFAULT_THEME_APPEARANCE.buttonRadius,
                      boxShadow: customThemeDraft.headerShadow ? THEME_SHADOWS[customThemeDraft.shadow ?? DEFAULT_THEME_APPEARANCE.shadow] : "none",
                    }}
                  >תצוגה מקדימה</div>
                  <div
                    className="border p-3 text-right"
                    style={{
                      background: customThemeDraft.card,
                      borderColor: customThemeDraft.accent,
                      borderRadius: customThemeDraft.cornerRadius ?? DEFAULT_THEME_APPEARANCE.cornerRadius,
                      borderWidth: customThemeDraft.borderWidth ?? DEFAULT_THEME_APPEARANCE.borderWidth,
                    }}
                  >
                    בראשית ברא אלהים את השמים ואת הארץ
                  </div>
                </div>
                <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-slate-950 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
                  {themesOnly && (
                  <Button onClick={() => setOpen(false)} variant="outline" className="gap-2 border-slate-500 bg-slate-900 text-white">
                    ביטול
                  </Button>
                  )}
                  <Button onClick={() => handleSaveCustomTheme(false)} disabled={savingCustomTheme} className="gap-2 bg-amber-500 font-bold text-slate-950 hover:bg-amber-400">
                    {savingCustomTheme ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {savingCustomTheme ? "שומר..." : "עדכן"}
                  </Button>
                  <Button onClick={() => handleSaveCustomTheme(true)} disabled={savingCustomTheme} variant="outline" className="gap-2 border-slate-500 bg-slate-900 text-white">
                    <Copy className="h-4 w-4" /> שכפל ושמור
                  </Button>
                  <Button onClick={handlePublishCustomTheme} disabled={savingCustomTheme || rolesLoading} className="col-span-2 gap-2 bg-blue-600 font-bold text-white hover:bg-blue-500">
                    {savingCustomTheme ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    פרסם לכולם
                  </Button>
                </div>
              </div>
            </Card>
            )}
            </div>
            <aside className="hidden border-r border-[#d5aa4547] bg-black/15 sm:order-last sm:block sm:sticky sm:top-0" aria-label="תצוגה מקדימה של ערכת הנושא">
              <div className="overflow-hidden p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] font-bold text-amber-300">
                  <span>⟳ תצוגה מקדימה</span>
                  <span className="truncate text-slate-300">{previewThemeDraft.name}</span>
                </div>
                <ChumashThemePreview preview={previewThemeDraft} />
                <p className="mt-2 text-center text-[9px] text-slate-400">השינויים מוצגים כאן לפני השמירה</p>
              </div>
            </aside>
            </div>
          </TabsContent>

          <TabsContent value="fonts" className="space-y-6">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3" dir="rtl">
                <div className="text-right">
                  <p className="font-semibold">איפוס גדלי טקסט</p>
                  <p className="text-sm text-muted-foreground">מחזיר את כל הגדלים והזום לברירת המחדל</p>
                </div>
                <Button variant="outline" onClick={resetTextSizesToDefault}>איפוס</Button>
              </div>
            </Card>

            {/* Pasuk Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">פסוקים</h3>
              <div className="space-y-3 pr-4">
                <div className="space-y-2">
                  <Label>גופן</Label>
                  <Select
                    value={settings.pasukFont}
                    onValueChange={(value) => updateSettings({ pasukFont: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">{settings.pasukSize}</span>
                    <Label>גודל</Label>
                  </div>
                  <Slider
                    value={[settings.pasukSize]}
                    onValueChange={([value]) => updateSettings({ pasukSize: value })}
                    min={8}
                    max={32}
                    step={1}
                    className="w-full"
                  />
                </div>

                <ColorPicker
                  label="צבע"
                  value={settings.pasukColor}
                  onChange={(color) => updateSettings({ pasukColor: color })}
                />

                <div className="flex items-center justify-between">
                  <Switch
                    checked={settings.pasukBold}
                    onCheckedChange={(checked) => updateSettings({ pasukBold: checked })}
                  />
                  <Label>מודגש (Bold)</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Title Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">כותרות</h3>
              <div className="space-y-3 pr-4">
                <div className="space-y-2">
                  <Label>גופן</Label>
                  <Select
                    value={settings.titleFont}
                    onValueChange={(value) => updateSettings({ titleFont: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">{settings.titleSize}</span>
                    <Label>גודל</Label>
                  </div>
                  <Slider
                    value={[settings.titleSize]}
                    onValueChange={([value]) => updateSettings({ titleSize: value })}
                    min={8}
                    max={28}
                    step={1}
                    className="w-full"
                  />
                </div>

                <ColorPicker
                  label="צבע"
                  value={settings.titleColor}
                  onChange={(color) => updateSettings({ titleColor: color })}
                />

                <div className="flex items-center justify-between">
                  <Switch
                    checked={settings.titleBold}
                    onCheckedChange={(checked) => updateSettings({ titleBold: checked })}
                  />
                  <Label>מודגש (Bold)</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Question Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">שאלות</h3>
              <div className="space-y-3 pr-4">
                <div className="space-y-2">
                  <Label>גופן</Label>
                  <Select
                    value={settings.questionFont}
                    onValueChange={(value) => updateSettings({ questionFont: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">{settings.questionSize}</span>
                    <Label>גודל</Label>
                  </div>
                  <Slider
                    value={[settings.questionSize]}
                    onValueChange={([value]) => updateSettings({ questionSize: value })}
                    min={8}
                    max={28}
                    step={1}
                    className="w-full"
                  />
                </div>

                <ColorPicker
                  label="צבע"
                  value={settings.questionColor}
                  onChange={(color) => updateSettings({ questionColor: color })}
                />

                <div className="flex items-center justify-between">
                  <Switch
                    checked={settings.questionBold}
                    onCheckedChange={(checked) => updateSettings({ questionBold: checked })}
                  />
                  <Label>מודגש (Bold)</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Answer Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">תשובות</h3>
              <div className="space-y-3 pr-4">
                <div className="space-y-2">
                  <Label>גופן</Label>
                  <Select
                    value={settings.answerFont}
                    onValueChange={(value) => updateSettings({ answerFont: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">{settings.answerSize}</span>
                    <Label>גודל</Label>
                  </div>
                  <Slider
                    value={[settings.answerSize]}
                    onValueChange={([value]) => updateSettings({ answerSize: value })}
                    min={8}
                    max={24}
                    step={1}
                    className="w-full"
                  />
                </div>

                <ColorPicker
                  label="צבע"
                  value={settings.answerColor}
                  onChange={(color) => updateSettings({ answerColor: color })}
                />

                <div className="flex items-center justify-between">
                  <Switch
                    checked={settings.answerBold}
                    onCheckedChange={(checked) => updateSettings({ answerBold: checked })}
                  />
                  <Label>מודגש (Bold)</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Commentary Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">מפרשים</h3>
              <div className="space-y-3 pr-4">
                <div className="space-y-2">
                  <Label>גופן</Label>
                  <Select
                    value={settings.commentaryFont}
                    onValueChange={(value) => updateSettings({ commentaryFont: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fonts.map((font) => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-primary">{settings.commentarySize}</span>
                    <Label>גודל</Label>
                  </div>
                  <Slider
                    value={[settings.commentarySize]}
                    onValueChange={([value]) => updateSettings({ commentarySize: value })}
                    min={8}
                    max={24}
                    step={1}
                    className="w-full"
                  />
                </div>

                <ColorPicker
                  label="צבע"
                  value={settings.commentaryColor}
                  onChange={(color) => updateSettings({ commentaryColor: color })}
                />

                <div className="flex items-center justify-between">
                  <Switch
                    checked={settings.commentaryBold}
                    onCheckedChange={(checked) => updateSettings({ commentaryBold: checked })}
                  />
                  <Label>מודגש (Bold)</Label>
                </div>
              </div>
            </div>

            {/* Preview */}
            <Separator />
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <h4 className="font-semibold text-sm text-muted-foreground">תצוגה מקדימה</h4>
              <div className="space-y-3">
                <p 
                  style={{ 
                    fontFamily: settings.pasukFont, 
                    fontSize: `${settings.pasukSize}px`,
                    color: settings.pasukColor,
                    fontWeight: settings.pasukBold ? 'bold' : 'normal'
                  }}
                  className="text-right"
                >
                  בְּרֵאשִׁית בָּרָא אֱלֹהִים
                </p>
                <p 
                  style={{ 
                    fontFamily: settings.titleFont, 
                    fontSize: `${settings.titleSize}px`,
                    color: settings.titleColor,
                    fontWeight: settings.titleBold ? 'bold' : 'normal'
                  }}
                  className="text-right"
                >
                  כותרת לדוגמה
                </p>
                <p 
                  style={{ 
                    fontFamily: settings.questionFont, 
                    fontSize: `${settings.questionSize}px`,
                    color: settings.questionColor,
                    fontWeight: settings.questionBold ? 'bold' : 'normal'
                  }}
                  className="text-right"
                >
                  מה הפירוש של המילה "בראשית"?
                </p>
                <p 
                  style={{ 
                    fontFamily: settings.answerFont, 
                    fontSize: `${settings.answerSize}px`,
                    color: settings.answerColor,
                    fontWeight: settings.answerBold ? 'bold' : 'normal'
                  }}
                  className="text-right"
                >
                  רש"י: בתחילת בריאת השמים והארץ
                </p>
                <p 
                  style={{ 
                    fontFamily: settings.commentaryFont, 
                    fontSize: `${settings.commentarySize}px`,
                    color: settings.commentaryColor,
                    fontWeight: settings.commentaryBold ? 'bold' : 'normal'
                  }}
                  className="text-right"
                >
                  רמב"ן: פירוש המילה "בראשית" - בתחילת הכל
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="display" className="space-y-6">
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-right">
                  <h3 className="font-semibold text-lg">רוחב כרטיסי הפסוקים במובייל</h3>
                  <p className="text-sm text-muted-foreground">
                    הכרטיסים מתרחבים ומתקצרים באופן שווה מימין ומשמאל
                  </p>
                </div>
                <span className="min-w-14 rounded-md bg-muted px-2 py-1 text-center text-sm font-semibold">
                  {displaySettings.verseSideMargin}px
                </span>
              </div>
              <Slider
                value={[displaySettings.verseSideMargin]}
                onValueChange={([value]) => updateDisplaySettings({ verseSideMargin: value })}
                min={0}
                max={32}
                step={1}
                aria-label="מרווח כרטיסי הפסוקים משני הצדדים"
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground" dir="rtl">
                <span>עד הקצה</span>
                <span>צר</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">יישור טקסט</h3>
              <RadioGroup 
                value={settings.textAlignment} 
                onValueChange={(value) => updateSettings({ textAlignment: value as any })}
                className="flex gap-4 justify-center"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="align-right" />
                  <Label htmlFor="align-right">ימין</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="center" id="align-center" />
                  <Label htmlFor="align-center">מרכז</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="align-left" />
                  <Label htmlFor="align-left">שמאל</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="justify" id="align-justify" />
                  <Label htmlFor="align-justify">ישור</Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">מרווח תוכן</h3>
              <RadioGroup 
                value={settings.contentSpacing} 
                onValueChange={(value) => updateSettings({ contentSpacing: value as any })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="compact" id="spacing-compact" />
                  <Label htmlFor="spacing-compact" className="flex-1 text-right">
                    <div className="font-semibold">צפוף</div>
                    <div className="text-sm text-muted-foreground">מרווח קטן בין אלמנטים</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="spacing-normal" />
                  <Label htmlFor="spacing-normal" className="flex-1 text-right">
                    <div className="font-semibold">רגיל</div>
                    <div className="text-sm text-muted-foreground">מרווח סטנדרטי</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="comfortable" id="spacing-comfortable" />
                  <Label htmlFor="spacing-comfortable" className="flex-1 text-right">
                    <div className="font-semibold">נוח</div>
                    <div className="text-sm text-muted-foreground">מרווח בינוני</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="spacious" id="spacing-spacious" />
                  <Label htmlFor="spacing-spacious" className="flex-1 text-right">
                    <div className="font-semibold">מרווח</div>
                    <div className="text-sm text-muted-foreground">מרווח גדול</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">גובה שורה</h3>
              <RadioGroup 
                value={settings.lineHeight} 
                onValueChange={(value) => updateSettings({ lineHeight: value as any })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tight" id="line-tight" />
                  <Label htmlFor="line-tight" className="flex-1 text-right">
                    <div className="font-semibold">צמוד</div>
                    <div className="text-sm text-muted-foreground">1.3 - שורות קרובות</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="line-normal" />
                  <Label htmlFor="line-normal" className="flex-1 text-right">
                    <div className="font-semibold">רגיל</div>
                    <div className="text-sm text-muted-foreground">1.5 - גובה סטנדרטי</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="relaxed" id="line-relaxed" />
                  <Label htmlFor="line-relaxed" className="flex-1 text-right">
                    <div className="font-semibold">רגוע</div>
                    <div className="text-sm text-muted-foreground">1.7 - שורות מרווחות</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="loose" id="line-loose" />
                  <Label htmlFor="line-loose" className="flex-1 text-right">
                    <div className="font-semibold">רפוי</div>
                    <div className="text-sm text-muted-foreground">2.0 - מרווח מקסימלי</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">רוחב תוכן</h3>
              <RadioGroup 
                value={settings.contentWidth} 
                onValueChange={(value) => updateSettings({ contentWidth: value as any })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="narrow" id="width-narrow" />
                  <Label htmlFor="width-narrow" className="flex-1 text-right">
                    <div className="font-semibold">צר</div>
                    <div className="text-sm text-muted-foreground">600px - מתאים לקריאה ממוקדת</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="width-normal" />
                  <Label htmlFor="width-normal" className="flex-1 text-right">
                    <div className="font-semibold">רגיל</div>
                    <div className="text-sm text-muted-foreground">800px - רוחב סטנדרטי</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="wide" id="width-wide" />
                  <Label htmlFor="width-wide" className="flex-1 text-right">
                    <div className="font-semibold">רחב</div>
                    <div className="text-sm text-muted-foreground">1000px - רוחב גדול</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="full" id="width-full" />
                  <Label htmlFor="width-full" className="flex-1 text-right">
                    <div className="font-semibold">מלא</div>
                    <div className="text-sm text-muted-foreground">100% - מילוי המסך</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </TabsContent>

          <TabsContent value="sefaria" className="space-y-4">
            <LocalDBManager />
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <AutoLoginSetting />

            <Card className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">הסימניות שלי</h3>
                <p className="text-sm text-muted-foreground">
                  צפה וערוך את כל הפסוקים שסימנת
                </p>
              </div>
              
              <div className="flex justify-center">
                <BookmarksDialog />
              </div>
            </Card>
            
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">הגדרות שיתוף</h3>
                <p className="text-sm text-muted-foreground">
                  בחר אם ברצונך לראות תכנים משותפים ממשתמשים אחרים
                </p>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <div className="flex-1 text-right">
                  <Label htmlFor="show-shared-toggle" className="text-base font-semibold cursor-pointer">
                    הצג תכנים משותפים
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    כאשר מופעל, תוכל לראות כותרות, שאלות ותשובות שמשתמשים אחרים שיתפו
                  </p>
                </div>
                <Switch
                  id="show-shared-toggle"
                  defaultChecked={true}
                />
              </div>
            </Card>
            
            <div className="text-center py-4">
              <DataManager />
            </div>
            <div className="text-sm text-muted-foreground text-right p-4 bg-muted/30 rounded-lg space-y-2">
              <p className="font-semibold">💾 מה נשמר בייצוא?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>כל ההגדרות (גופנים, צבעים, ערכות נושא)</li>
                <li>הערות שהוספת לפסוקים</li>
                <li>סימניות והדגשות</li>
                <li>תוכן חדש שיצרת (שאלות, תשובות, כותרות)</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2 justify-end">
                  <span>שירותי API</span>
                  <Plug className="h-5 w-5 text-primary" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  חבר שירותים חיצוניים לשיפור חוויית הלימוד
                </p>
              </div>

              <Separator />

              {/* OpenAI */}
              {renderApiService('OpenAI', 'חיבור ל-ChatGPT לפירושים, שאלות ותשובות ותרגומים', [
                { key: 'api_openai_key', label: 'API Key', placeholder: 'sk-...', type: 'password' },
              ])}

              {/* Google Cloud */}
              {renderApiService('Google Cloud', 'טקסט לדיבור (TTS), תרגום ושירותי AI נוספים', [
                { key: 'api_google_key', label: 'API Key', placeholder: 'AIza...', type: 'password' },
              ])}

              {/* Sefaria API - always connected */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs text-primary">זמין (ציבורי)</span>
                  </div>
                  <h4 className="font-semibold">Sefaria API</h4>
                </div>
                <p className="text-sm text-muted-foreground text-right">
                  גישה לספריית ספרות יהודית — טקסטים, תרגומים ומפרשים
                </p>
                <div className="p-3 bg-primary/5 rounded-lg text-right">
                  <p className="text-sm text-primary">✓ שירות ציבורי — לא דורש מפתח API</p>
                </div>
              </div>

              {/* Supabase - always connected */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs text-primary">מחובר</span>
                  </div>
                  <h4 className="font-semibold">בסיס נתונים</h4>
                </div>
                <p className="text-sm text-muted-foreground text-right">
                  בסיס הנתונים, אימות משתמשים וסנכרון
                </p>
                <div className="p-3 bg-primary/5 rounded-lg text-right">
                  <p className="text-sm text-primary">✓ מחובר ופעיל</p>
                </div>
              </div>

              {/* ElevenLabs */}
              {renderApiService('ElevenLabs', 'הקראת טקסט קדוש בקול טבעי ואיכותי', [
                { key: 'api_elevenlabs_key', label: 'API Key', placeholder: 'xi-...', type: 'password' },
              ])}

              {/* Anthropic */}
              {renderApiService('Anthropic (Claude)', 'AI מתקדם לניתוח טקסטים, פירושים וסיכומים', [
                { key: 'api_anthropic_key', label: 'API Key', placeholder: 'sk-ant-...', type: 'password' },
              ])}

              <Separator className="my-2" />
              <h3 className="font-semibold text-base text-right">הודעות ותקשורת</h3>

              {/* Twilio */}
              {renderApiService('Twilio', 'שליחת הודעות WhatsApp ו-SMS — פרשת שבוע, תזכורות ושיתוף תכנים', [
                { key: 'api_twilio_sid', label: 'Account SID', placeholder: 'AC...', type: 'password' },
                { key: 'api_twilio_token', label: 'Auth Token', placeholder: 'token...', type: 'password' },
                { key: 'api_twilio_whatsapp_number', label: 'מספר WhatsApp (לדוג׳ +14155238886)', placeholder: '+1...', type: 'text' },
              ])}

              {/* SendGrid */}
              {renderApiService('SendGrid', 'שליחת מיילים — סיכום שבועי, שיתוף פרשה ועדכונים', [
                { key: 'api_sendgrid_key', label: 'API Key', placeholder: 'SG...', type: 'password' },
                { key: 'api_sendgrid_from', label: 'כתובת שולח (From Email)', placeholder: 'noreply@example.com', type: 'email' },
              ])}

              {/* Mailgun */}
              {renderApiService('Mailgun', 'חלופה לשליחת מיילים — תמיכה ברשימות תפוצה ותבניות', [
                { key: 'api_mailgun_key', label: 'API Key', placeholder: 'key-...', type: 'password' },
                { key: 'api_mailgun_domain', label: 'Domain', placeholder: 'mg.example.com', type: 'text' },
              ])}

              <Separator className="my-2" />
              <h3 className="font-semibold text-base text-right">התראות Push</h3>

              {/* VAPID Web Push */}
              {renderApiService('VAPID – Web Push', 'מפתחות להתראות Push ברקע — גם כשהדפדפן סגור. המפתחות משמשים לאימות מול שרתי Google/Mozilla.', [
                { key: 'api_vapid_public_key', label: 'Public Key', placeholder: 'BLSFD4oo...', type: 'password' },
                { key: 'api_vapid_private_key', label: 'Private Key', placeholder: 'MmrMQn...', type: 'password' },
                { key: 'api_vapid_subject', label: 'Subject (mailto:)', placeholder: 'mailto:you@example.com', type: 'email' },
              ])}
            </Card>

            <div className="text-sm text-muted-foreground text-right p-4 bg-muted/30 rounded-lg space-y-2">
              <p className="font-semibold">☁️ סנכרון ענן</p>
              <p>מפתחות ה-API נשמרים בענן ומסונכרנים בין כל המכשירים שלך. {!user && '(יש להתחבר כדי לסנכרן)'}</p>
            </div>
          </TabsContent>

          {import.meta.env.DEV && <TabsContent value="dev" className="space-y-4">
            <Card className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">אייקוני פיתוח</h3>
                <p className="text-sm text-muted-foreground">
                  הפעלה וכיבוי של כפתורי הפיתוח במסך הראשי, עם שמירת המצב האחרון
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Switch
                  id="dev-floating-toggle"
                  checked={devFloatingEnabled}
                  onCheckedChange={handleDevFloatingToggle}
                />
                <div className="flex-1 text-right mr-3">
                  <Label htmlFor="dev-floating-toggle" className="text-base font-semibold cursor-pointer">
                    כל כפתורי הפיתוח המסומנים
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    כיבוי אחד שסוגר את כל הכפתורים הצפים שסימנת
                  </p>
                </div>
                <div className="ml-2 text-muted-foreground">
                  {devFloatingEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Switch
                  id="dev-chat-toggle"
                  checked={devChatEnabled}
                  onCheckedChange={handleDevChatToggle}
                  disabled={!devFloatingEnabled}
                />
                <div className="flex-1 text-right mr-3">
                  <Label htmlFor="dev-chat-toggle" className="text-base font-semibold cursor-pointer">
                    אייקון צ'אט פיתוח
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    מציג/מסתיר את כפתור הצ'אט הצף בצד שמאל
                  </p>
                </div>
                <div className="ml-2 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="ml-2 text-muted-foreground">
                  {devChatEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Switch
                  id="dev-screenshot-toggle"
                  checked={devScreenshotEnabled}
                  onCheckedChange={handleDevScreenshotToggle}
                  disabled={!devFloatingEnabled}
                />
                <div className="flex-1 text-right mr-3">
                  <Label htmlFor="dev-screenshot-toggle" className="text-base font-semibold cursor-pointer">
                    אייקון צילום פיתוח
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    מציג/מסתיר את כפתור הצילום הצף בצד שמאל
                  </p>
                </div>
                <div className="ml-2 text-primary">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="ml-2 text-muted-foreground">
                  {devScreenshotEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Switch
                  id="dev-layout-editor-toggle"
                  checked={devLayoutEditorEnabled}
                  onCheckedChange={handleDevLayoutEditorToggle}
                  disabled={!devFloatingEnabled}
                />
                <div className="flex-1 text-right mr-3">
                  <Label htmlFor="dev-layout-editor-toggle" className="text-base font-semibold cursor-pointer">
                    אייקון Layout Editor
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    מציג/מסתיר את האייקון הסגול של עריכת פריסה (Ctrl+Shift+L)
                  </p>
                </div>
                <div className="ml-2 text-muted-foreground">
                  {devLayoutEditorEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Switch
                  id="dev-chumash-trace-toggle"
                  checked={devChumashTraceEnabled}
                  onCheckedChange={handleDevChumashTraceToggle}
                />
                <div className="flex-1 text-right mr-3">
                  <Label htmlFor="dev-chumash-trace-toggle" className="text-base font-semibold cursor-pointer">
                    Trace חומש
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    מפעיל מעקב פנימי בתצוגת החומש (לוגים בקונסול)
                  </p>
                </div>
                <div className="ml-2 text-primary">
                  <Code className="h-5 w-5" />
                </div>
                <div className="ml-2 text-muted-foreground">
                  {devChumashTraceEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">דיבאג ביצועים</h3>
                <p className="text-sm text-muted-foreground">
                  מעקב אחרי קפיצות פריסה (CLS) ורינדורים מיותרים. הלוגים נכתבים לקונסול הדפדפן.
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                <Switch
                  id="debug-renders-toggle"
                  checked={debugRendersEnabled}
                  onCheckedChange={handleDebugRendersToggle}
                />
                <div className="flex-1 text-right mr-3">
                  <Label htmlFor="debug-renders-toggle" className="text-base font-semibold cursor-pointer">
                    דיבאג רינדורים וקפיצות (CLS)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    אחרי הפעלה ורענון: כל קפיצת פריסה תודפס בקונסול עם האלמנט שקפץ. בקונסול אפשר להריץ <code>__dumpRenders()</code> לטבלת רינדורים.
                  </p>
                </div>
                <div className="ml-2 text-primary">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
            </Card>

            <MigrationManager />
          </TabsContent>}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
