import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const TIMEOUTS_MIN: Record<string, number> = {
  school_admin: 15,
  super_admin: 15,
  secretary: 20,
  teacher: 30,
  parent: 60,
};
const WARN_BEFORE_MIN = 2;

export const INACTIVITY_LOGOUT_KEY = "inactivity_logout_flag";

export function InactivityGuard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalMs = user ? (TIMEOUTS_MIN[user.role] ?? 15) * 60 * 1000 : 0;
  const warnMs = WARN_BEFORE_MIN * 60 * 1000;

  const clearAll = useCallback(() => {
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    warnTimerRef.current = null;
    logoutTimerRef.current = null;
    tickRef.current = null;
  }, []);

  const doLogout = useCallback(async () => {
    clearAll();
    setWarnOpen(false);
    try {
      sessionStorage.setItem(INACTIVITY_LOGOUT_KEY, "1");
    } catch {}
    await logout();
    navigate({ to: "/login", replace: true });
  }, [clearAll, logout, navigate]);

  const startTimers = useCallback(() => {
    clearAll();
    setWarnOpen(false);
    if (!user || totalMs <= 0) return;
    warnTimerRef.current = setTimeout(() => {
      setSecondsLeft(Math.floor(warnMs / 1000));
      setWarnOpen(true);
      tickRef.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    }, totalMs - warnMs);
    logoutTimerRef.current = setTimeout(() => {
      doLogout();
    }, totalMs);
  }, [clearAll, doLogout, totalMs, warnMs, user]);

  const onActivity = useCallback(() => {
    if (warnOpen) return; // don't silently reset while warning is up
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => startTimers(), 500);
  }, [startTimers, warnOpen]);

  useEffect(() => {
    if (!user) {
      clearAll();
      setWarnOpen(false);
      return;
    }
    startTimers();
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "click",
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearAll();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const stayConnected = () => {
    setWarnOpen(false);
    startTimers();
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (!user) return null;

  return (
    <Dialog open={warnOpen} onOpenChange={(o) => { if (!o) stayConnected(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Clock className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Session bientôt expirée</DialogTitle>
          <DialogDescription className="text-center">
            Votre session va expirer dans <strong>{mm}:{ss}</strong> par inactivité.
            Cliquez pour rester connecté.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={doLogout}>Se déconnecter</Button>
          <Button onClick={stayConnected}>Rester connecté</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
