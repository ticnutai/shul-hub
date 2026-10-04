import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/**
 * The app as installed from Google Play - not the website, and not the copy
 * downloaded from the site ("אושר של יהודי - גרסה חדשה", its own id).
 *
 * What it leaves out: the TV boards (their management, and the files that
 * install them). The boards are run from the website; and an app from the
 * store may not hand out apps from outside it.
 */
export const STORE_APP_ID = "com.ticnutai.bsr3synagogue";

let known: boolean | null = Capacitor.isNativePlatform() ? null : false;
let asking: Promise<boolean> | null = null;

export function isStoreApp(): Promise<boolean> {
  if (known !== null) return Promise.resolve(known);
  asking ??= CapacitorApp.getInfo()
    .then((info) => (known = info.id === STORE_APP_ID))
    .catch(() => (known = false));
  return asking;
}

export function useIsStoreApp(): boolean {
  const [store, setStore] = useState(known ?? false);
  useEffect(() => {
    if (known !== null) return;
    let alive = true;
    void isStoreApp().then((v) => alive && setStore(v));
    return () => {
      alive = false;
    };
  }, []);
  return store;
}
