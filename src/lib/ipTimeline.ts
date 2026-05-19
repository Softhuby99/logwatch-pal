/**
 * IP Timeline Aggregator
 *
 * Aggregiert security_events + auth_events pro IP zu einer chronologischen
 * Timeline. Liefert außerdem Top-Angreifer-Listen für 24h / 7T / 30T.
 *
 * Spätere FastAPI-Variante:
 *   GET /api/ip/{ip}/timeline?from=...&to=...
 *   GET /api/top-attackers?window=24h|7d|30d
 */

import {
  mockSecurityEvents,
  mockAuthEvents,
  mockIPSummary,
  mockIPEnrichment,
  mockIPRiskScore,
} from "@/data/mockSecurityData";
import type {
  SecurityEvent,
  AuthEvent,
  IpSummary,
  IpEnrichment,
  IpRiskScore,
  AlertLevel,
} from "@/types/database";

// ============================================================
// Unified Timeline Event
// ============================================================

export type TimelineEventKind =
  | "ban"
  | "unban"
  | "auth_failure"
  | "auth_success"
  | "security_event"
  | "crowdsec";

export interface IpTimelineEvent {
  id: string; // unique key (table:id)
  source_table: "security_events" | "auth_events";
  kind: TimelineEventKind;
  event_time: string;
  alert_level: AlertLevel;
  source_system: string;
  source_component: string | null;
  /** kurzer maschinen-lesbarer Typ z.B. "banning", "SMTP_AUTH_FAILED" */
  type_label: string;
  /** sprechende Beschreibung */
  description: string;
  username: string | null;
  target_email: string | null;
  destination_port: number | null;
  destination_service: string | null;
  request_path: string | null;
  http_method: string | null;
  http_status: number | null;
  scenario_name: string | null;
  message: string;
}

const classifySecurity = (e: SecurityEvent): TimelineEventKind => {
  // Ban-/Unban-Events können sowohl über ban_status (Pipeline-normalisiert)
  // als auch über event_type (roher Wert aus netfilter/crowdsec) erkannt werden.
  const et = (e.event_type || "").toLowerCase();
  const reason = (e.normalized_reason || "").toUpperCase();
  if (
    e.ban_status === "banning" ||
    et === "ban" ||
    et === "banning" ||
    reason === "BANNING" ||
    reason.includes("BRUTEFORCE") && (e.source_component === "crowdsec" || et === "ban")
  ) return "ban";
  if (
    e.ban_status === "unbanning" ||
    et === "unban" ||
    et === "unbanning" ||
    reason === "UNBANNING"
  ) return "unban";
  if (e.source_component === "crowdsec" || e.source_system === "opnsense") return "crowdsec";
  if (reason.includes("AUTH_FAILED")) return "auth_failure";
  return "security_event";
};

const toTimelineFromSecurity = (e: SecurityEvent): IpTimelineEvent => ({
  id: `sec:${e.id}`,
  source_table: "security_events",
  kind: classifySecurity(e),
  event_time: e.event_time,
  alert_level: e.alert_level,
  source_system: e.source_system,
  source_component: e.source_component ?? null,
  type_label: e.normalized_reason || e.event_type,
  description: e.attack_reason || e.raw_reason || e.event_type,
  username: null,
  target_email: e.target_email,
  destination_port: e.destination_port,
  destination_service: e.destination_service,
  request_path: e.request_path,
  http_method: e.http_method,
  http_status: e.http_status,
  scenario_name: e.scenario_name,
  message: e.message,
});

const toTimelineFromAuth = (e: AuthEvent): IpTimelineEvent => ({
  id: `auth:${e.id}`,
  source_table: "auth_events",
  kind: e.auth_status === "success" ? "auth_success" : "auth_failure",
  event_time: e.event_time,
  alert_level: e.alert_level,
  source_system: e.source_system,
  source_component: e.source_component ?? null,
  type_label: e.normalized_reason || `${e.login_type.toUpperCase()}_AUTH_${e.auth_status.toUpperCase()}`,
  description: e.raw_reason || `Auth ${e.auth_status} (${e.login_type})`,
  username: e.username,
  target_email: null,
  destination_port: e.destination_port,
  destination_service: e.destination_service,
  request_path: e.request_path,
  http_method: e.http_method,
  http_status: e.http_status,
  scenario_name: null,
  message: e.message,
});

// ============================================================
// API
// ============================================================

export interface IpTimelineBundle {
  ip: string;
  summary: IpSummary | null;
  enrichment: IpEnrichment | null;
  risk: IpRiskScore | null;
  events: IpTimelineEvent[]; // sorted desc by time
  stats: {
    total: number;
    bans: number;
    unbans: number;
    auth_failures: number;
    auth_successes: number;
    crowdsec: number;
    other: number;
    first_seen: string | null;
    last_seen: string | null;
  };
  /** Aggregation pro Tag für Mini-Chart (letzte 30 Tage) */
  daily: Array<{
    date: string; // YYYY-MM-DD
    bans: number;
    auth_failures: number;
    crowdsec: number;
    other: number;
  }>;
  /** Aggregation nach normalized_reason / type_label */
  by_type: Array<{ type: string; count: number }>;
  /** Ban/Unban-Intervalle (chronologisch) */
  ban_intervals: BanInterval[];
}

export type BanEndReason = "unban" | "next_ban" | "expired" | "status_clean" | null;

export interface BanInterval {
  /** Eindeutige Id (= ban-event-id) */
  id: string;
  /** Start des Bans (ISO) */
  banned_at: string;
  /** Ende des Bans (ISO) – null wenn noch aktiv */
  unbanned_at: string | null;
  /** Dauer in ms (bei aktiven Bans bis "jetzt") */
  duration_ms: number;
  /** true = noch aktiv */
  active: boolean;
  source_system: string;
  source_component: string | null;
  reason: string;
  scenario_name: string | null;
  /** Wie wurde das Ende des Bans bestimmt? null = aktiv */
  end_reason: BanEndReason;
}

/** Default-Bandauern pro Quelle (für heuristische Ableitung des Endes) */
const DEFAULT_BAN_DURATION_MS: Record<string, number> = {
  crowdsec: 4 * 60 * 60 * 1000,
  opnsense: 4 * 60 * 60 * 1000,
  netfilter: 10 * 60 * 1000,
  mailcow: 10 * 60 * 1000,
  default: 60 * 60 * 1000,
};

const guessBanDurationMs = (source_system: string, source_component: string | null): number => {
  const sys = (source_system || "").toLowerCase();
  const comp = (source_component || "").toLowerCase();
  return (
    DEFAULT_BAN_DURATION_MS[comp] ??
    DEFAULT_BAN_DURATION_MS[sys] ??
    DEFAULT_BAN_DURATION_MS.default
  );
};

/**
 * Paart Ban- mit Unban-Events. Wenn keine Unban-Events existieren (häufig in
 * Live-Daten), werden Enden heuristisch abgeleitet:
 *  - Folge-Ban schließt vorherige offene Bans
 *  - Default-Bandauer pro Quelle → "abgelaufen"
 *  - current_status der IP: nur wenn 'banned' darf der letzte Ban aktiv bleiben
 */
const computeBanIntervals = (
  events: IpTimelineEvent[],
  summary: IpSummary | null = null
): BanInterval[] => {
  const asc = [...events].sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
  );
  const intervals: BanInterval[] = [];
  const openBans: IpTimelineEvent[] = [];

  const pushClosed = (ban: IpTimelineEvent, endIso: string, end_reason: BanEndReason) => {
    const start = new Date(ban.event_time).getTime();
    const end = new Date(endIso).getTime();
    intervals.push({
      id: ban.id,
      banned_at: ban.event_time,
      unbanned_at: endIso,
      duration_ms: Math.max(0, end - start),
      active: false,
      source_system: ban.source_system,
      source_component: ban.source_component,
      reason: ban.description || ban.type_label,
      scenario_name: ban.scenario_name,
      end_reason,
    });
  };

  asc.forEach((ev) => {
    if (ev.kind === "ban") {
      // Folge-Ban schließt alle vorigen offenen Bans derselben IP
      while (openBans.length > 0) {
        const prev = openBans.shift()!;
        pushClosed(prev, ev.event_time, "next_ban");
      }
      openBans.push(ev);
    } else if (ev.kind === "unban") {
      const ban = openBans.shift();
      if (ban) {
        pushClosed(ban, ev.event_time, "unban");
      } else {
        intervals.push({
          id: ev.id,
          banned_at: ev.event_time,
          unbanned_at: ev.event_time,
          duration_ms: 0,
          active: false,
          source_system: ev.source_system,
          source_component: ev.source_component,
          reason: "Unban ohne erfasstes Ban-Event",
          scenario_name: ev.scenario_name,
          end_reason: "unban",
        });
      }
    }
  });

  const nowMs = Date.now();
  const statusIsBanned = summary?.current_status === "banned";

  openBans.forEach((ban, idx) => {
    const start = new Date(ban.event_time).getTime();
    const isLast = idx === openBans.length - 1;
    const defaultDur = guessBanDurationMs(ban.source_system, ban.source_component);
    const expiryMs = start + defaultDur;

    if (nowMs > expiryMs && (!isLast || !statusIsBanned)) {
      pushClosed(ban, new Date(expiryMs).toISOString(), "expired");
      return;
    }

    if (isLast && summary && !statusIsBanned) {
      const endIso = summary.last_seen || new Date(nowMs).toISOString();
      pushClosed(ban, endIso, "status_clean");
      return;
    }

    intervals.push({
      id: ban.id,
      banned_at: ban.event_time,
      unbanned_at: null,
      duration_ms: Math.max(0, nowMs - start),
      active: true,
      source_system: ban.source_system,
      source_component: ban.source_component,
      reason: ban.description || ban.type_label,
      scenario_name: ban.scenario_name,
      end_reason: null,
    });
  });

  return intervals.sort(
    (a, b) => new Date(b.banned_at).getTime() - new Date(a.banned_at).getTime()
  );
};

const computeDaily = (events: IpTimelineEvent[]) => {
  const map = new Map<string, { bans: number; auth_failures: number; crowdsec: number; other: number }>();
  // 30 leere Tage
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { bans: 0, auth_failures: 0, crowdsec: 0, other: 0 });
  }
  events.forEach((ev) => {
    const key = ev.event_time.slice(0, 10);
    const bucket = map.get(key);
    if (!bucket) return;
    if (ev.kind === "ban" || ev.kind === "unban") bucket.bans++;
    else if (ev.kind === "auth_failure") bucket.auth_failures++;
    else if (ev.kind === "crowdsec") bucket.crowdsec++;
    else bucket.other++;
  });
  return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
};

/**
 * Baut ein IpTimelineBundle aus beliebigen Quell-Events
 * (z.B. live aus der API oder aus den Mocks).
 */
export const buildIpTimelineBundle = (
  ip: string,
  secEvents: SecurityEvent[],
  authEvents: AuthEvent[],
  summary: IpSummary | null,
  enrichment: IpEnrichment | null,
  risk: IpRiskScore | null
): IpTimelineBundle => {
  const sec = secEvents.map(toTimelineFromSecurity);
  const auth = authEvents.map(toTimelineFromAuth);
  const events = [...sec, ...auth].sort(
    (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime()
  );
  return assembleBundle(ip, events, summary, enrichment, risk);
};

export const getIpTimeline = (ip: string): IpTimelineBundle => {
  const sec = mockSecurityEvents.filter((e) => e.ip === ip).map(toTimelineFromSecurity);
  const auth = mockAuthEvents.filter((e) => e.ip === ip).map(toTimelineFromAuth);
  const events = [...sec, ...auth].sort(
    (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime()
  );

  const summary = mockIPSummary.find((s) => s.ip === ip) ?? null;
  const enrichment = mockIPEnrichment.find((e) => e.ip === ip) ?? null;
  const risk = mockIPRiskScore.find((r) => r.ip === ip) ?? null;
  return assembleBundle(ip, events, summary, enrichment, risk);
};

const assembleBundle = (
  ip: string,
  events: IpTimelineEvent[],
  summary: IpSummary | null,
  enrichment: IpEnrichment | null,
  risk: IpRiskScore | null
): IpTimelineBundle => {

  const stats = {
    total: events.length,
    bans: events.filter((e) => e.kind === "ban").length,
    unbans: events.filter((e) => e.kind === "unban").length,
    auth_failures: events.filter((e) => e.kind === "auth_failure").length,
    auth_successes: events.filter((e) => e.kind === "auth_success").length,
    crowdsec: events.filter((e) => e.kind === "crowdsec").length,
    other: events.filter((e) => e.kind === "security_event").length,
    first_seen: events.length ? events[events.length - 1].event_time : summary?.first_seen ?? null,
    last_seen: events.length ? events[0].event_time : summary?.last_seen ?? null,
  };

  // by_type
  const typeMap = new Map<string, number>();
  events.forEach((e) => typeMap.set(e.type_label, (typeMap.get(e.type_label) ?? 0) + 1));
  const by_type = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    ip,
    summary,
    enrichment,
    risk,
    events,
    stats,
    daily: computeDaily(events),
    by_type,
    ban_intervals: computeBanIntervals(events),
  };
};

// ============================================================
// Top Attackers per Window
// ============================================================

export type TimeWindow = "24h" | "7d" | "30d";

export interface TopAttackerRow {
  ip: string;
  total_events: number;
  bans: number;
  auth_failures: number;
  crowdsec: number;
  last_seen: string;
  last_alert_level: AlertLevel | null;
  last_event_type: string | null;
  country: string | null;
  org_name: string | null;
  asn: string | null;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRIT";
}

const windowMs = (w: TimeWindow): number => {
  if (w === "24h") return 24 * 60 * 60 * 1000;
  if (w === "7d") return 7 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
};

export const getTopAttackers = (window: TimeWindow, limit = 25): TopAttackerRow[] => {
  const cutoff = Date.now() - windowMs(window);
  const map = new Map<string, TopAttackerRow>();

  const upsert = (
    ip: string,
    timeIso: string,
    alert: AlertLevel,
    eventType: string,
    incBan = 0,
    incAuthFail = 0,
    incCrowdsec = 0
  ) => {
    const t = new Date(timeIso).getTime();
    if (t < cutoff) return;
    const enrich = mockIPEnrichment.find((e) => e.ip === ip);
    const risk = mockIPRiskScore.find((r) => r.ip === ip);
    const cur = map.get(ip) ?? {
      ip,
      total_events: 0,
      bans: 0,
      auth_failures: 0,
      crowdsec: 0,
      last_seen: timeIso,
      last_alert_level: alert,
      last_event_type: eventType,
      country: enrich?.country ?? null,
      org_name: enrich?.org_name ?? null,
      asn: enrich?.asn ?? null,
      risk_score: risk?.score ?? 0,
      risk_level: risk?.risk_level ?? "LOW",
    };
    cur.total_events++;
    cur.bans += incBan;
    cur.auth_failures += incAuthFail;
    cur.crowdsec += incCrowdsec;
    if (new Date(timeIso).getTime() > new Date(cur.last_seen).getTime()) {
      cur.last_seen = timeIso;
      cur.last_alert_level = alert;
      cur.last_event_type = eventType;
    }
    map.set(ip, cur);
  };

  mockSecurityEvents.forEach((e) => {
    upsert(
      e.ip,
      e.event_time,
      e.alert_level,
      e.normalized_reason || e.event_type,
      e.ban_status === "banning" ? 1 : 0,
      0,
      e.source_component === "crowdsec" || e.source_system === "opnsense" ? 1 : 0
    );
  });
  mockAuthEvents.forEach((e) => {
    if (!e.ip) return;
    upsert(
      e.ip,
      e.event_time,
      e.alert_level,
      e.normalized_reason || `AUTH_${e.auth_status.toUpperCase()}`,
      0,
      e.auth_status === "failed" ? 1 : 0,
      0
    );
  });

  return Array.from(map.values())
    .sort((a, b) => b.risk_score - a.risk_score || b.total_events - a.total_events)
    .slice(0, limit);
};

// ============================================================
// Attack Timeline Buckets (für Stacked-Area-Chart + Drilldown)
// ============================================================

export interface AttackBucket {
  /** Bucket-Start als ISO */
  time: string;
  brute_force: number;
  port_scan: number;
  auth_failure: number;
  ban: number;
  unban: number;
  crawl_probe: number;
  total: number;
}

/** Klassifiziert ein Event in eine Chart-Kategorie */
const classifyForChart = (
  ev: IpTimelineEvent
): "brute_force" | "port_scan" | "auth_failure" | "ban" | "unban" | "crawl_probe" | null => {
  if (ev.kind === "ban") return "ban";
  if (ev.kind === "unban") return "unban";
  if (ev.kind === "auth_failure") {
    // wiederholte Auth-Fehler werden als brute_force gewertet, einzelne als auth_failure
    return ev.type_label?.includes("BRUTE") ? "brute_force" : "auth_failure";
  }
  if (ev.kind === "crowdsec") {
    const t = (ev.type_label || "").toUpperCase();
    if (t.includes("PROBING") || t.includes("SCAN") || t.includes("PORT")) return "port_scan";
    if (t.includes("CRAWL") || t.includes("SENSITIVE") || t.includes("ADMIN") || t.includes("HTTP"))
      return "crawl_probe";
    return "crawl_probe";
  }
  if (ev.kind === "security_event") {
    const t = (ev.type_label || "").toUpperCase();
    if (t.includes("BRUTE")) return "brute_force";
    if (t.includes("AUTH")) return "auth_failure";
    return "crawl_probe";
  }
  return null;
};

/** Liefert alle Events als IpTimelineEvent (über alle IPs) */
const allTimelineEvents = (): IpTimelineEvent[] => {
  return [
    ...mockSecurityEvents.map(toTimelineFromSecurity),
    ...mockAuthEvents.filter((e) => e.ip).map(toTimelineFromAuth),
  ];
};

/**
 * Baut Buckets über die letzten `totalHours` Stunden, jeder Bucket ist `bucketHours` lang.
 * Default: 7 Tage à 4h = 42 Buckets.
 */
export const buildAttackBuckets = (
  bucketHours = 4,
  totalHours = 24 * 7
): AttackBucket[] => {
  const bucketMs = bucketHours * 60 * 60 * 1000;
  const totalMs = totalHours * 60 * 60 * 1000;
  const now = Date.now();
  // Bucket-Start = abgerundet auf bucketMs
  const end = Math.floor(now / bucketMs) * bucketMs;
  const start = end - totalMs;

  const count = Math.ceil(totalMs / bucketMs);
  const buckets: AttackBucket[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * bucketMs;
    buckets.push({
      time: new Date(t).toISOString(),
      brute_force: 0,
      port_scan: 0,
      auth_failure: 0,
      ban: 0,
      unban: 0,
      crawl_probe: 0,
      total: 0,
    });
  }

  const events = allTimelineEvents();
  events.forEach((ev) => {
    const t = new Date(ev.event_time).getTime();
    if (t < start || t >= end + bucketMs) return;
    const idx = Math.floor((t - start) / bucketMs);
    if (idx < 0 || idx >= buckets.length) return;
    const cat = classifyForChart(ev);
    if (!cat) return;
    buckets[idx][cat]++;
    buckets[idx].total++;
  });

  return buckets;
};

export interface BucketDetail {
  bucket_start: string;
  bucket_end: string;
  bucket_hours: number;
  events: IpTimelineEvent[];
  by_category: { brute_force: number; port_scan: number; auth_failure: number; ban: number; unban: number; crawl_probe: number };
  by_ip: Array<{
    ip: string;
    count: number;
    last_seen: string;
    last_alert_level: AlertLevel;
    country: string | null;
    org_name: string | null;
    risk_score: number;
    risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRIT";
    categories: { brute_force: number; port_scan: number; auth_failure: number; ban: number; unban: number; crawl_probe: number };
  }>;
}

/**
 * Liefert alle Events innerhalb eines Bucket-Fensters.
 * `bucketStartIso` ist der Start des Buckets (gleicher Wert wie in buildAttackBuckets()).
 */
export const getBucketDetail = (bucketStartIso: string, bucketHours = 4): BucketDetail => {
  const start = new Date(bucketStartIso).getTime();
  const end = start + bucketHours * 60 * 60 * 1000;

  const events = allTimelineEvents()
    .filter((ev) => {
      const t = new Date(ev.event_time).getTime();
      return t >= start && t < end;
    })
    .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime());

  const by_category = { brute_force: 0, port_scan: 0, auth_failure: 0, ban: 0, unban: 0, crawl_probe: 0 };
  const ipMap = new Map<string, BucketDetail["by_ip"][number]>();

  events.forEach((ev) => {
    const cat = classifyForChart(ev);
    if (cat) by_category[cat]++;

    const enrich = mockIPEnrichment.find((e) => e.ip === ev.id ? false : e.ip === (ev as any).ip);
    // ipTimelineEvent hat keine "ip" – wir holen sie aus dem Original-Event über die ID
    // Wir tracken per "id" prefix nicht möglich → wir machen es über Re-Lookup:
  });

  // Re-build with ip via the original sources to keep things simple
  const secInWindow = mockSecurityEvents.filter((e) => {
    const t = new Date(e.event_time).getTime();
    return t >= start && t < end;
  });
  const authInWindow = mockAuthEvents.filter((e) => {
    if (!e.ip) return false;
    const t = new Date(e.event_time).getTime();
    return t >= start && t < end;
  });

  const upsertIp = (
    ip: string,
    timeIso: string,
    alert: AlertLevel,
    cat: ReturnType<typeof classifyForChart>
  ) => {
    const enrich = mockIPEnrichment.find((e) => e.ip === ip);
    const risk = mockIPRiskScore.find((r) => r.ip === ip);
    const cur = ipMap.get(ip) ?? {
      ip,
      count: 0,
      last_seen: timeIso,
      last_alert_level: alert,
      country: enrich?.country ?? null,
      org_name: enrich?.org_name ?? null,
      risk_score: risk?.score ?? 0,
      risk_level: risk?.risk_level ?? "LOW",
      categories: { brute_force: 0, port_scan: 0, auth_failure: 0, ban: 0, unban: 0, crawl_probe: 0 },
    };
    cur.count++;
    if (cat) cur.categories[cat]++;
    if (new Date(timeIso).getTime() > new Date(cur.last_seen).getTime()) {
      cur.last_seen = timeIso;
      cur.last_alert_level = alert;
    }
    ipMap.set(ip, cur);
  };

  secInWindow.forEach((e) =>
    upsertIp(e.ip, e.event_time, e.alert_level, classifyForChart(toTimelineFromSecurity(e)))
  );
  authInWindow.forEach((e) =>
    upsertIp(e.ip!, e.event_time, e.alert_level, classifyForChart(toTimelineFromAuth(e)))
  );

  const by_ip = Array.from(ipMap.values()).sort(
    (a, b) => b.risk_score - a.risk_score || b.count - a.count
  );

  return {
    bucket_start: new Date(start).toISOString(),
    bucket_end: new Date(end).toISOString(),
    bucket_hours: bucketHours,
    events,
    by_category,
    by_ip,
  };
};
