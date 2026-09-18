#!/usr/bin/env node
/**
 * tv-control.mjs — see and drive the board running on the Android TV.
 *
 * Two channels, because they reach different things:
 *
 *   ADB  (adb shell ...)  the device: install, launch, remote-control keys,
 *                         full-screen screenshots, native logs.
 *   CDP  (DevTools)       inside the WebView: DOM text, run JavaScript, console,
 *                         network, page screenshots. uiautomator cannot see
 *                         any of this - the WebView is opaque to it.
 *
 * CDP needs `webContentsDebuggingEnabled` in capacitor.config.tv.ts (on by
 * default for this app) and an authorised ADB connection. No npm packages:
 * Node 22+ ships a global WebSocket.
 *
 * Usage (from the repo root):
 *   node scripts/tv-control.mjs status                 device, app, page, sync state
 *   node scripts/tv-control.mjs text                   visible text of the page
 *   node scripts/tv-control.mjs eval "<js>"            run JS in the page, print result
 *   node scripts/tv-control.mjs console [seconds]      stream console output (default 30)
 *   node scripts/tv-control.mjs network [seconds]      log requests/responses (default 30)
 *   node scripts/tv-control.mjs shot <file.png>        screenshot of the whole TV screen
 *   node scripts/tv-control.mjs key <up|down|left|right|ok|back|home|menu> [times]
 *   node scripts/tv-control.mjs reload                 reload the page (keeps the app)
 *   node scripts/tv-control.mjs restart                force-stop and relaunch the app
 *   node scripts/tv-control.mjs install [apk]          install (default: release APK) + launch
 *   node scripts/tv-control.mjs autostart              allow the board to reopen after power-on
 *
 * Device: the single device in `adb devices`, or TV_ADB=192.168.33.10:41289.
 * The wireless-debugging port changes when the TV reboots; if nothing is
 * connected, run `adb connect <ip>:<port>` with the port shown on the TV.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const APP_ID = process.env.TV_APP_ID || "com.ticnutai.bsr3synagogue.tv";
const CDP_PORT = Number(process.env.TV_CDP_PORT || 9222);
const DEFAULT_APK = "android-tv/app/build/outputs/apk/release/app-release.apk";

/* -------------------------------------------------------------------- adb */

function findAdb() {
  const candidates = [
    process.env.ADB,
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb.exe"),
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", "adb"),
    path.join(os.homedir(), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || "adb";
}
const ADB = findAdb();

function adbRaw(args, opts = {}) {
  return execFileSync(ADB, args, { encoding: opts.binary ? undefined : "utf8", maxBuffer: 64e6, ...opts });
}

function pickDevice() {
  if (process.env.TV_ADB) return process.env.TV_ADB;
  const lines = adbRaw(["devices"]).split(/\r?\n/).slice(1).filter((l) => /\tdevice$/.test(l));
  if (lines.length === 1) return lines[0].split("\t")[0];
  if (lines.length === 0)
    die("No authorised device. On the TV: Settings > Developer options > Wireless debugging; then `adb connect <ip>:<port>`.");
  die(`Several devices connected (${lines.map((l) => l.split("\t")[0]).join(", ")}). Set TV_ADB=<ip:port>.`);
}

let device;
const adb = (...args) => adbRaw(["-s", device, ...args]);
const shell = (cmd) => adb("shell", cmd).replace(/\r/g, "").trim();

function die(msg) {
  console.error(`\nSTOP: ${msg}\n`);
  process.exit(1);
}

function appPid() {
  const out = shell(`pidof ${APP_ID} || true`);
  return out ? out.split(/\s+/)[0] : null;
}

/* -------------------------------------------------------------------- cdp */

// Forwards the WebView's devtools socket and returns the page target. The
// socket name embeds the PID, so this is redone on every call: the app may
// have been restarted since the last one.
async function pageTarget() {
  const pid = appPid();
  if (!pid) die(`${APP_ID} is not running. Try: node scripts/tv-control.mjs restart`);
  const sockets = shell("cat /proc/net/unix | grep devtools_remote || true");
  const socket = `webview_devtools_remote_${pid}`;
  if (!sockets.includes(socket))
    die(
      "The WebView debug socket is closed. The installed APK was built without webContentsDebuggingEnabled - rebuild (npm run tv:apk:release) and reinstall.",
    );
  adb("forward", `tcp:${CDP_PORT}`, `localabstract:${socket}`);
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`, { signal: AbortSignal.timeout(10_000) });
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page");
  if (!page) die(`No page target on the socket (got: ${targets.map((t) => t.type).join(", ") || "none"}).`);
  return page;
}

// Minimal CDP client: one WebSocket, request/response by id, events by method.
async function cdp() {
  const page = await pageTarget();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("could not open the DevTools WebSocket"));
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      pending.delete(msg.id);
      // Without this the timeout timer kept Node alive after the answer had
      // arrived: every command printed its result, then hung for the full
      // timeout (up to 120 s) before exiting.
      clearTimeout(timer);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  };
  return {
    page,
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        // Evaluated code may legitimately wait (e.g. for the next slide, which
        // is up to a full 60s rotation away); protocol calls should not.
        const limit = method === "Runtime.evaluate" ? 120_000 : 20_000;
        const timer = setTimeout(() => {
          if (pending.delete(id)) reject(new Error(`${method} timed out after ${limit / 1000}s`));
        }, limit);
        pending.set(id, { resolve, reject, timer });
      });
    },
    on(method, fn) {
      listeners.set(method, [...(listeners.get(method) || []), fn]);
    },
    close() {
      ws.close();
    },
  };
}

async function evaluate(client, expression) {
  const r = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/* --------------------------------------------------------------- commands */

const KEYS = {
  up: "KEYCODE_DPAD_UP",
  down: "KEYCODE_DPAD_DOWN",
  left: "KEYCODE_DPAD_LEFT",
  right: "KEYCODE_DPAD_RIGHT",
  ok: "KEYCODE_DPAD_CENTER",
  enter: "KEYCODE_ENTER",
  back: "KEYCODE_BACK",
  home: "KEYCODE_HOME",
  menu: "KEYCODE_MENU",
};

const commands = {
  async status() {
    const model = shell("getprop ro.product.model");
    const android = shell("getprop ro.build.version.release");
    const version = (shell(`dumpsys package ${APP_ID} | grep versionName || true`).match(/versionName=(\S+)/) || [])[1];
    const top = shell("dumpsys activity activities | grep topResumedActivity || true");
    console.log(`device   : ${device}  (${model}, Android ${android})`);
    console.log(`app      : ${version ? `installed, version ${version}` : "NOT installed"}`);
    console.log(`running  : ${appPid() ? `yes, pid ${appPid()}` : "no"}`);
    console.log(`on screen: ${top.includes(APP_ID) ? "yes (foreground)" : top.replace(/.*\{[^ ]+ [^ ]+ /, "").replace(/ t\d+\}.*/, "") || "?"}`);
    const overlay = shell(`appops get ${APP_ID} SYSTEM_ALERT_WINDOW || true`);
    console.log(`autostart: ${/allow/.test(overlay) ? "enabled" : "NOT enabled - run: node scripts/tv-control.mjs autostart"}`);
    if (!appPid()) return;
    const c = await cdp();
    const info = await evaluate(
      c,
      `({
        title: document.title,
        heading: document.querySelector('.tv-slide-heading')?.childNodes[0]?.textContent?.trim() ?? null,
        slide: [...document.querySelectorAll('.tv-dot')].findIndex(d => d.classList.contains('is-active')) + 1,
        slides: document.querySelectorAll('.tv-dot').length,
        sync: document.querySelector('.tv-status')?.textContent?.trim() ?? null,
        online: navigator.onLine,
        snapshots: Object.keys(localStorage).filter(k => k.startsWith('shul-tv-snapshot:')).length,
        viewport: innerWidth + 'x' + innerHeight,
      })`,
    );
    c.close();
    console.log(`page     : ${info.title}`);
    console.log(`slide    : ${info.slide}/${info.slides}  "${info.heading}"`);
    console.log(`sync     : ${info.sync}   (navigator.onLine=${info.online})`);
    console.log(`offline  : ${info.snapshots} data snapshots saved on the box`);
    console.log(`viewport : ${info.viewport}`);
  },

  async text() {
    const c = await cdp();
    console.log(await evaluate(c, "document.body.innerText"));
    c.close();
  },

  async eval(expression) {
    if (!expression) die('usage: eval "<javascript>"');
    const c = await cdp();
    const value = await evaluate(c, expression);
    console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    c.close();
  },

  async console(seconds = "30") {
    const c = await cdp();
    c.on("Runtime.consoleAPICalled", (p) =>
      console.log(`[${p.type}] ${p.args.map((a) => a.value ?? a.description ?? a.type).join(" ")}`),
    );
    c.on("Runtime.exceptionThrown", (p) =>
      console.log(`[EXCEPTION] ${p.exceptionDetails.exception?.description || p.exceptionDetails.text}`),
    );
    c.on("Log.entryAdded", (p) => console.log(`[${p.entry.level}] ${p.entry.text} ${p.entry.url || ""}`));
    await c.send("Runtime.enable");
    await c.send("Log.enable");
    console.log(`listening for ${seconds}s ...`);
    await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
    c.close();
  },

  async network(seconds = "30") {
    const c = await cdp();
    const started = new Map();
    c.on("Network.requestWillBeSent", (p) => started.set(p.requestId, { url: p.request.url, method: p.request.method, t: p.timestamp }));
    c.on("Network.responseReceived", (p) => {
      const s = started.get(p.requestId);
      const ms = s ? Math.round((p.timestamp - s.t) * 1000) : "?";
      console.log(`${String(p.response.status).padEnd(4)} ${String(ms).padStart(5)}ms  ${s?.method ?? ""} ${p.response.url.slice(0, 140)}`);
    });
    c.on("Network.loadingFailed", (p) => console.log(`FAIL        ${started.get(p.requestId)?.url ?? p.requestId}  ${p.errorText}`));
    c.on("Network.webSocketCreated", (p) => console.log(`WS          ${p.url.slice(0, 140)}`));
    await c.send("Network.enable");
    console.log(`listening for ${seconds}s ...`);
    await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
    c.close();
  },

  async shot(file) {
    if (!file) die("usage: shot <file.png>");
    fs.writeFileSync(file, adbRaw(["-s", device, "exec-out", "screencap", "-p"], { binary: true }));
    console.log(`saved ${file}`);
  },

  async key(name, times = "1") {
    const code = KEYS[name];
    if (!code) die(`unknown key "${name}". One of: ${Object.keys(KEYS).join(", ")}`);
    for (let i = 0; i < Number(times); i++) shell(`input keyevent ${code}`);
    console.log(`sent ${name} x${times}`);
  },

  async reload() {
    const c = await cdp();
    await c.send("Page.reload", { ignoreCache: true });
    c.close();
    console.log("page reloaded");
  },

  async restart() {
    shell(`am force-stop ${APP_ID}`);
    console.log(shell(`am start -W -n ${APP_ID}/.MainActivity`).split("\n").filter((l) => /Status|TotalTime/.test(l)).join("  "));
  },

  // Grants "display over other apps", the exemption Android 10+ requires before
  // BootReceiver may bring the board back after a power cut. Without it the
  // start is dropped silently. Survives reboots and `install -r`; an uninstall
  // clears it.
  async autostart() {
    shell(`appops set ${APP_ID} SYSTEM_ALERT_WINDOW allow`);
    const state = shell(`appops get ${APP_ID} SYSTEM_ALERT_WINDOW`);
    console.log(`SYSTEM_ALERT_WINDOW: ${state}`);
    if (!/allow/.test(state)) die("the permission did not stick - is the APK declaring SYSTEM_ALERT_WINDOW?");
    console.log("auto-start after power-on is enabled");
  },

  async install(apk = DEFAULT_APK) {
    if (!fs.existsSync(apk)) die(`APK not found: ${apk}  (build it: npm run tv:apk:release)`);
    const r = spawnSync(ADB, ["-s", device, "install", "-r", apk], { encoding: "utf8" });
    console.log((r.stdout + r.stderr).trim().split("\n").pop());
    if (r.status !== 0) process.exit(1);
    await commands.restart();
  },
};

/* ------------------------------------------------------------------- main */

const [command, ...args] = process.argv.slice(2);
if (!command || !commands[command]) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").match(/Usage[\s\S]*?\*\n \* Device/)[0].replace(/^ \* ?/gm, "").replace(/\n Device$/, ""));
  process.exit(command ? 1 : 0);
}
device = pickDevice();
try {
  await commands[command](...args);
} catch (error) {
  die(error.message);
}
