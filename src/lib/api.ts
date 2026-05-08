/**
 * API client for Dashboard backend.
 * Falls back gracefully when API is unreachable (e.g. Lovable preview).
 */

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function apiFetch<T>(path: string, fallback: T): Promise<{ data: T; live: boolean }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { data: data as T, live: true };
  } catch {
    return { data: fallback, live: false };
  }
}

// ── Types ────────────────────────────────────────────────────

export interface StatsResponse {
  security_events: { value: number; h24: number; d7: number; d30: number };
  banned_ips: { value: number; h24: number; d7: number; d30: number };
  auth_failures: { value: number; h24: number; d7: number; d30: number };
  crowdsec_alerts: { value: number; h24: number; d7: number; d30: number };
}

export interface GeoAttackRow {
  country: string;
  count: number;
  bans: number;
  last_seen: string;
}

export interface AuthTimelineRow {
  hour: string;
  bucket_start?: string;
  smtp: number;
  imap: number;
  other?: number;
}

export interface EventsBySourceRow {
  source: string;
  h24: number;
  d7: number;
  d30: number;
  fill: string;
  fillMid: string;
  fillLight: string;
}

// ── Endpoint functions ───────────────────────────────────────

export const fetchStats = (fallback: StatsResponse) =>
  apiFetch<StatsResponse>("/stats", fallback);

export const fetchSecurityEvents = <T>(fallback: T[], limit = 50) =>
  apiFetch<T[]>(`/security-events?limit=${limit}`, fallback);

export const fetchAuthEvents = <T>(fallback: T[], limit = 50) =>
  apiFetch<T[]>(`/auth-events?limit=${limit}`, fallback);

export const fetchCrowdsecAlerts = <T>(fallback: T[]) =>
  apiFetch<T[]>("/crowdsec-alerts?limit=50", fallback);

export const fetchTopAttackers = <T>(window: string, fallback: T[], limit = 25) =>
  apiFetch<T[]>(`/top-attackers?window=${window}&limit=${limit}`, fallback);

export const fetchIpStats7d = <T>(fallback: T[]) =>
  apiFetch<T[]>("/ip-stats-7d", fallback);

export const fetchAggressiveIps30d = <T>(fallback: T[]) =>
  apiFetch<T[]>("/aggressive-ips-30d", fallback);

export const fetchInternalAuthProblems = <T>(fallback: T[]) =>
  apiFetch<T[]>("/internal-auth-problems", fallback);

export const fetchAttackTimeline = <T>(fallback: T[]) =>
  apiFetch<T[]>("/attack-timeline?hours=168&bucket=4", fallback);

export const fetchAuthTimeline = (fallback: AuthTimelineRow[]) =>
  apiFetch<AuthTimelineRow[]>("/auth-timeline", fallback);

export const fetchEventsBySource = (fallback: EventsBySourceRow[]) =>
  apiFetch<EventsBySourceRow[]>("/events-by-source", fallback);

export const fetchGeoAttacks = (fallback: GeoAttackRow[]) =>
  apiFetch<GeoAttackRow[]>("/geo-attacks", fallback);

export const fetchIpDetail = <T>(ip: string, fallback: T) =>
  apiFetch<T>(`/ip/${ip}`, fallback);

export const fetchIpEvents = <T>(ip: string, fallback: T) =>
  apiFetch<T>(`/ip/${ip}/events`, fallback);

export const fetchIpDaily = <T>(ip: string, fallback: T[]) =>
  apiFetch<T[]>(`/ip/${ip}/daily`, fallback);

export interface HealthCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "error" | "skip";
  latency_ms?: number;
  detail?: string;
  children?: { target: string; ok: boolean; latency_ms: number; detail: string }[];
}
export interface HealthResponse {
  overall: "ok" | "warn" | "error";
  checked_at: string;
  cached?: boolean;
  checks: HealthCheck[];
}
export const fetchHealthChecks = (fallback: HealthResponse) =>
  apiFetch<HealthResponse>("/health/checks", fallback);
