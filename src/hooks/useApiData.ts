import { useState, useEffect, useRef, useCallback } from "react";
import { useApiLive } from "@/contexts/ApiLiveContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";

/**
 * Generic hook that calls an API fetcher on mount and at an interval,
 * returning { data, loading, live }.
 * `live` = true means data came from the real API (not mock fallback).
 *
 * If `refreshMs` is omitted, the global refresh rate from RefreshSettingsContext is used.
 */
export function useApiData<T>(
  fetcher: () => Promise<{ data: T; live: boolean }>,
  deps: unknown[] = [],
  refreshMs?: number
): { data: T | null; loading: boolean; live: boolean; refresh: () => void } {
  const { refreshMs: globalMs, refreshNonce } = useRefreshSettings();
  const effectiveMs = refreshMs ?? globalMs;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const mountedRef = useRef(true);
  const { report } = useApiLive();

  const load = useCallback(async () => {
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result.data);
        setLive(result.live);
        report(result.live);
      }
    } catch (err) {
      console.error("API fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    load();
    const interval = setInterval(load, effectiveMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load, effectiveMs, refreshNonce]);

  return { data, loading, live, refresh: load };
}
