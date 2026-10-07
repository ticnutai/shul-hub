import { describe, expect, it } from "vitest";
import { ZMAN_DISPLAY_KEYS, type Zmanim } from "@community/lib/zmanim";
import { DEFAULT_ALERT_LOOK, DEFAULT_TV_CONFIG, normalizeTvConfig } from "./config";
import { ALERT_PRESETS, alertLookVars, currentZmanAlert, stagedZmanAlerts, describeMinutes, formatCountdown } from "./zmanAlerts";

const at = (h: number, m: number, s = 0) => new Date(2026, 8, 18, h, m, s);

const zmanim = {
  sof_zman_shma: at(9, 31),
  sof_zman_tefila: at(10, 33),
  sunset: at(18, 45),
  candle: at(18, 5),
} as unknown as Zmanim;

const alerts = {...DEFAULT_TV_CONFIG.alerts,mode:'pulse' as const}; // legacy pulse mode

describe('staged deadlines',()=>{
  // Staged alerts are chosen by the gabbai: every time, in the staged mode.
  const staged={...DEFAULT_TV_CONFIG.alerts,mode:'staged' as const,events:[...ZMAN_DISPLAY_KEYS]};
  it.each([[1800001,null],[1800000,'highlight'],[1200001,'highlight'],[1200000,'panel'],[600001,'panel'],[600000,'board'],[1,'board'],[0,null],[-1,null]])('boundary %s milliseconds → %s',(left,stage)=>{
    const end=at(10,33);const now=new Date(end.getTime()-Number(left));
    const result=currentZmanAlert(now,{sof_zman_tefila:end} as Zmanim,staged,false);
    expect(result?.stage??null).toBe(stage);
  });
  it('supports every time, including both MGA72 deadlines, with explicit labels',()=>{
    for(const event of staged.events){
      const result=currentZmanAlert(at(10,0),{[event]:at(10,20)} as Zmanim,staged,true);
      expect(result?.event).toBe(event);expect(result?.stage).toBe('panel');
      if(event.includes('mga72'))expect(result?.label).toContain('מג״א');
    }
  });
  it('highlights concurrent deadlines and counts to the nearest; transitions when it passes',()=>{
    const times={sof_zman_tefila:at(10,20),sof_zman_tefila_mga72:at(10,10)} as Zmanim;
    expect(stagedZmanAlerts(at(10,0),times,staged,false).map(a=>a.event)).toEqual(['sof_zman_tefila_mga72','sof_zman_tefila']);
    expect(currentZmanAlert(at(10,10),times,staged,false)?.event).toBe('sof_zman_tefila');
    expect(currentZmanAlert(at(10,20),times,staged,false)).toBeNull();
    expect(currentZmanAlert(at(10,0),times,{...staged,enabled:false},false)).toBeNull();
    expect(currentZmanAlert(at(10,0),times,{...staged,events:[]},false)).toBeNull();
  });
  it('a board saved before staged alerts keeps exactly the alerts it had; staged only when chosen',()=>{
    expect(normalizeTvConfig({alerts:{enabled:true,events:['sunset']}}).alerts).toMatchObject({enabled:true,mode:'pulse',events:['sunset']});
    expect(normalizeTvConfig({}).alerts).toMatchObject({mode:'pulse',events:['sof_zman_shma','sof_zman_tefila','sunset','candle']});
    expect(normalizeTvConfig({alerts:{mode:'staged',events:['sof_zman_tefila_mga72']}}).alerts).toMatchObject({mode:'staged',events:['sof_zman_tefila_mga72']});
    // The words a board has been showing do not change.
    expect(currentZmanAlert(at(9,10),{sof_zman_shma:at(9,31)} as Zmanim,DEFAULT_TV_CONFIG.alerts,false)?.label).toBe('סוף זמן קריאת שמע');
  });
});

describe("currentZmanAlert", () => {
  it("is silent well before any deadline", () => {
    expect(currentZmanAlert(at(8, 0), zmanim, alerts, false)).toBeNull();
  });

  it("shows only the footer chip between leads", () => {
    const a = currentZmanAlert(at(9, 10), zmanim, alerts, false);
    expect(a?.event).toBe("sof_zman_shma");
    expect(a?.popup).toBe(false);
    expect(a?.secondsLeft).toBe(21 * 60);
  });

  it("pops the reminder card exactly at a lead, for popupSeconds", () => {
    const start = currentZmanAlert(at(9, 16), zmanim, alerts, false); // 15:00 left
    expect(start?.popup).toBe(true);
    expect(start?.lead).toBe(15);
    const end = currentZmanAlert(at(9, 16, 41), zmanim, alerts, false); // 40 s later
    expect(end?.popup).toBe(false);
  });

  it("disappears once the deadline has passed", () => {
    expect(currentZmanAlert(at(9, 31, 1), zmanim, alerts, false)).toBeNull();
  });

  it("only warns about candle lighting on Friday", () => {
    expect(currentZmanAlert(at(17, 50), zmanim, alerts, false)).toBeNull();
    expect(currentZmanAlert(at(17, 50), zmanim, alerts, true)?.event).toBe("candle");
  });

  it("prefers the closest deadline", () => {
    // 18:20 on Friday: candle 18:05 has passed, sunset 18:45 is 25 min away.
    expect(currentZmanAlert(at(18, 20), zmanim, alerts, true)?.event).toBe("sunset");
  });

  it("respects the admin switching alerts off", () => {
    expect(currentZmanAlert(at(9, 16), zmanim, { ...alerts, enabled: false }, false)).toBeNull();
  });
});

describe("countdown text", () => {
  it("formats minutes:seconds and hours", () => {
    expect(formatCountdown(14 * 60 + 5)).toBe("14:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
  });

  it("describes remaining minutes in Hebrew", () => {
    expect(describeMinutes(30)).toBe("בעוד פחות מדקה");
    expect(describeMinutes(15 * 60)).toBe("בעוד 15 דקות");
  });
});

describe("normalizeTvConfig", () => {
  it("returns a full default config for garbage", () => {
    expect(normalizeTvConfig("nonsense")).toEqual(DEFAULT_TV_CONFIG);
    expect(normalizeTvConfig(null).slides).toHaveLength(DEFAULT_TV_CONFIG.slides.length);
  });

  it("keeps the admin's slide order and drops unknown kinds", () => {
    const cfg = normalizeTvConfig({
      slides: [
        { kind: "shiurim", enabled: true, seconds: 10, layout: "cards" },
        { kind: "bogus", enabled: true },
        { kind: "prayer", enabled: false, seconds: 999, layout: "nope" },
      ],
    });
    expect(cfg.slides[0]).toEqual({ kind: "shiurim", enabled: true, seconds: 10, layout: "cards" });
    // clamped seconds, unknown layout falls back to the default
    expect(cfg.slides[1]).toEqual({ kind: "prayer", enabled: false, seconds: 300, layout: "split" });
    // kinds missing from the saved row are appended so they can be switched on
    expect(cfg.slides.map((s) => s.kind)).toContain("learning");
  });

  it("rejects non-https images and unknown themes", () => {
    const cfg = normalizeTvConfig({
      theme: "hotpink",
      backgroundImage: "javascript:alert(1)",
      slideshow: { images: [{ url: "http://x/a.jpg" }, { url: "https://x/b.jpg" }] },
    });
    expect(cfg.theme).toBe("navy");
    expect(cfg.backgroundImage).toBeNull();
    expect(cfg.slideshow.images).toEqual([{ url: "https://x/b.jpg", caption: undefined }]);
  });
});

describe("the gabbai's steps, and how the reminder looks", () => {
  const staged = { ...DEFAULT_TV_CONFIG.alerts, mode: "staged" as const, events: ["sof_zman_tefila" as const] };
  const times = { sof_zman_tefila: at(10, 33) } as unknown as Zmanim;
  const stageAt = (h: number, m: number, stages = staged.stages) => stagedZmanAlerts(at(h, m), times, { ...staged, stages }, false)[0]?.stage ?? null;

  it("keeps 30 / 20 / 10 until they are changed", () => {
    expect([stageAt(10, 2), stageAt(10, 4), stageAt(10, 14), stageAt(10, 24), stageAt(10, 33)]).toEqual([null, "highlight", "panel", "board", null]);
  });
  it("follows the steps set, and leaves out a step of 0", () => {
    const s = { highlight: 45, panel: 0, board: 5 };
    expect([stageAt(9, 47, s), stageAt(9, 49, s), stageAt(10, 20, s), stageAt(10, 29, s)]).toEqual([null, "highlight", "highlight", "board"]);
  });
  it("reads the steps back in order, and refuses nonsense", () => {
    expect(normalizeTvConfig({ alerts: { stages: { highlight: 15, panel: 40, board: 60 } } }).alerts.stages).toEqual({ highlight: 15, panel: 15, board: 15 });
    expect(normalizeTvConfig({ alerts: { stages: "soon" } }).alerts.stages).toEqual({ highlight: 30, panel: 20, board: 10 });
    expect(normalizeTvConfig({ alerts: { stages: { highlight: 500, panel: -3, board: 10 } } }).alerts.stages).toEqual({ highlight: 120, panel: 0, board: 10 });
  });
  it("keeps the look chosen, and anything unknown is the usual look", () => {
    const look = { style: "crimson", shape: "arch", size: "small", position: "top", dim: "none", icon: "candle", colors: { bg: "#000000", text: "#ffffff", accent: "#ff0000" } };
    expect(normalizeTvConfig({ alerts: { look } }).alerts.look).toEqual(look);
    expect(normalizeTvConfig({ alerts: { look: { style: "neon", shape: "star", colors: { bg: "red" } } } }).alerts.look).toEqual(DEFAULT_ALERT_LOOK);
    expect(normalizeTvConfig({}).alerts.look).toEqual(DEFAULT_ALERT_LOOK);
  });
  it("gives the board its colours only when the look has its own", () => {
    expect(alertLookVars(DEFAULT_ALERT_LOOK)["--al-bg"]).toBeUndefined();
    expect(alertLookVars({ ...DEFAULT_ALERT_LOOK, style: "gold" })).toMatchObject({ "--al-bg": ALERT_PRESETS.gold.bg, "--al-accent": ALERT_PRESETS.gold.accent });
    expect(alertLookVars({ ...DEFAULT_ALERT_LOOK, style: "custom", colors: { bg: "#111111", text: "#eeeeee", accent: "#abcdef" } })["--al-accent"]).toBe("#abcdef");
    expect(alertLookVars({ ...DEFAULT_ALERT_LOOK, size: "small" })["--al-scale"]).toBe("0.72");
    expect(alertLookVars({ ...DEFAULT_ALERT_LOOK, shape: "pill" })["--al-radius"]).toBe("999px");
  });
});
