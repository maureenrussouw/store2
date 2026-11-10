import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

// useOnlineStatus tracks whether the desktop client can reach the API.
//
// "Online" here means two things together:
//   1) the OS reports a network connection (navigator.onLine), AND
//   2) the API has answered a heartbeat in the last HEARTBEAT_INTERVAL_MS
//
// We need both because navigator.onLine only reflects the OS-level network
// link — it returns true even when the API is down or the user is on a
// captive-portal Wi-Fi that hasn't been authenticated. The API heartbeat
// is the truth signal; navigator.onLine is just a cheap pre-check that
// stops us from making a doomed request when the laptop lid was just
// closed.
//
// The heartbeat hits GET /api/health which Grit's API exposes for free —
// no auth required, no DB hit, fast 200 OK.

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 5_000;

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      // OS says no network → don't even try.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (!cancelled) {
          setIsOnline(false);
          setLastCheckedAt(new Date());
        }
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
        await apiClient.get("/health", { signal: controller.signal, timeout: HEARTBEAT_TIMEOUT_MS });
        clearTimeout(timeoutId);
        if (!cancelled) {
          setIsOnline(true);
          setLastCheckedAt(new Date());
        }
      } catch {
        if (!cancelled) {
          setIsOnline(false);
          setLastCheckedAt(new Date());
        }
      }
    };

    ping();
    timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    const handleOnline = () => ping();
    const handleOffline = () => {
      if (!cancelled) {
        setIsOnline(false);
        setLastCheckedAt(new Date());
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  return { isOnline, lastCheckedAt };
}
