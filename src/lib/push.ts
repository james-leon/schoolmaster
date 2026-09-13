import { useCallback, useEffect, useState } from "react";
import { getVapidPublicKey, removePushSubscription, savePushSubscription } from "./push.functions";

export type PushState = "unsupported" | "ios-needs-install" | "default" | "denied" | "granted";

export type StandaloneSignals = {
  isIos: boolean;
  navigatorStandalone: boolean;
  displayModeStandalone: boolean;
  standalone: boolean;
};

export function getStandaloneSignals(): StandaloneSignals {
  if (typeof window === "undefined") {
    return { isIos: false, navigatorStandalone: false, displayModeStandalone: false, standalone: false };
  }
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  const navigatorStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return {
    isIos,
    navigatorStandalone,
    displayModeStandalone,
    standalone: navigatorStandalone || displayModeStandalone,
  };
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS/iPadOS only allows web push for apps added to the home screen. */
export function isIosWithoutStandalone(): boolean {
  const signals = getStandaloneSignals();
  return signals.isIos && !signals.standalone;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Ask the browser for permission and register this device for push. */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return isIosWithoutStandalone() ? "ios-needs-install" : "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "default";

  const registration = await getRegistration();
  await navigator.serviceWorker.ready;

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) throw new Error("Push not configured");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Invalid subscription");

  await savePushSubscription({
    data: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
    },
  });

  return "granted";
}

/** Unregister this device (keeps browser permission intact). */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    /* ignore */
  }
  try {
    await removePushSubscription({ data: { endpoint } });
  } catch {
    /* ignore */
  }
}

/** Reactive push status for this device. */
export function usePushStatus() {
  const [state, setState] = useState<PushState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState(isIosWithoutStandalone() ? "ios-needs-install" : "unsupported");
      setSubscribed(false);
      setLoading(false);
      return;
    }
    setState(Notification.permission as PushState);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      setSubscribed(!!subscription);
    } catch {
      setSubscribed(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      await refresh();
      return next;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await disablePush();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { state, subscribed, loading, busy, enable, disable, refresh };
}
