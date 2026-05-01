import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ApiLiveContextValue {
  /** true sobald irgendein API-Hook in den letzten 60s eine erfolgreiche Antwort hatte */
  live: boolean;
  /** wird von useApiData aufgerufen */
  report: (live: boolean) => void;
}

const ApiLiveContext = createContext<ApiLiveContextValue>({ live: false, report: () => {} });

export function ApiLiveProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState(false);
  const lastLiveAt = useRef<number>(0);

  const report = useCallback((isLive: boolean) => {
    if (isLive) {
      lastLiveAt.current = Date.now();
      setLive(true);
    }
  }, []);

  // Falls 90s lang nichts mehr live war → demo-Modus
  useEffect(() => {
    const t = setInterval(() => {
      if (lastLiveAt.current && Date.now() - lastLiveAt.current > 90_000) {
        setLive(false);
      }
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  return <ApiLiveContext.Provider value={{ live, report }}>{children}</ApiLiveContext.Provider>;
}

export const useApiLive = () => useContext(ApiLiveContext);
