import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface RefreshSettingsValue {
  refreshMs: number;
  setRefreshMs: (ms: number) => void;
  refreshNonce: number;
  triggerRefresh: () => void;
}

const STORAGE_KEY = "dashboard.refreshMs";
const DEFAULT_MS = 30_000;

const RefreshSettingsContext = createContext<RefreshSettingsValue>({
  refreshMs: DEFAULT_MS,
  setRefreshMs: () => {},
  refreshNonce: 0,
  triggerRefresh: () => {},
});

export function RefreshSettingsProvider({ children }: { children: ReactNode }) {
  const [refreshMs, setRefreshMsState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_MS;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 5_000 ? n : DEFAULT_MS;
  });
  const [refreshNonce, setRefreshNonce] = useState(0);

  const setRefreshMs = useCallback((ms: number) => {
    setRefreshMsState(ms);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(refreshMs));
    } catch {
      /* ignore */
    }
  }, [refreshMs]);

  const triggerRefresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  return (
    <RefreshSettingsContext.Provider value={{ refreshMs, setRefreshMs, refreshNonce, triggerRefresh }}>
      {children}
    </RefreshSettingsContext.Provider>
  );
}

export const useRefreshSettings = () => useContext(RefreshSettingsContext);
