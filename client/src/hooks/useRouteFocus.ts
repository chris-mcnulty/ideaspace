import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const RETRY_INTERVAL_MS = 50;
const MAX_RETRIES = 40; // ~2 seconds total

export function useRouteFocus(targetId: string = "main-content") {
  const [location] = useLocation();
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    let attempts = 0;
    let timerId: number | null = null;
    const tryFocus = () => {
      const el = document.getElementById(targetId);
      if (el) {
        if (!el.hasAttribute("tabindex")) {
          el.setAttribute("tabindex", "-1");
        }
        el.focus({ preventScroll: true });
        return;
      }
      attempts += 1;
      if (attempts < MAX_RETRIES) {
        timerId = window.setTimeout(tryFocus, RETRY_INTERVAL_MS);
      }
    };
    timerId = window.setTimeout(tryFocus, 0);
    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [location, targetId]);
}
