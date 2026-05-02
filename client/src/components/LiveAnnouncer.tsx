import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Politeness = "polite" | "assertive";

type AnnouncerContextValue = {
  announce: (message: string, politeness?: Politeness) => void;
};

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((message: string, politeness: Politeness = "polite") => {
    if (!message) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (politeness === "assertive") {
      setAssertiveMessage("");
      requestAnimationFrame(() => setAssertiveMessage(message));
    } else {
      setPoliteMessage("");
      requestAnimationFrame(() => setPoliteMessage(message));
    }
    timeoutRef.current = setTimeout(() => {
      setPoliteMessage("");
      setAssertiveMessage("");
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region-polite"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        data-testid="live-region-assertive"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer() {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) {
    return { announce: () => {} } as AnnouncerContextValue;
  }
  return ctx;
}
