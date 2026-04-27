/**
 * Database Schema Types
 * 
 * 1:1 Mapping zur LogCollector v2.9.3 MariaDB.
 * Feldnamen sind snake_case (identisch mit DB-Spalten),
 * damit beim späteren Umstieg auf die FastAPI kein Mapping nötig ist.
 *
 * Quelle: src/database/schema.sql, src/models/event_context.py, src/database/db_manager.py
 */

// ============================================================
// Enums (1:1 zu MariaDB Enums)
// ============================================================

export type SourceSystem =
  | "mailcow"
  | "pmg"
  | "opnsense"
  | "nginx"
  | "system";

export type SourceComponent =
  | "postfix"
  | "netfilter"
  | "dovecot"
  | "crowdsec"
  | "nginx"
  | "ssh"
  | "system"
  | string; // varchar(50) – defensiv offen

export type AlertLevel = "INFO" | "WARN" | "CRIT";

export type AuthStatus = "success" | "failed";

export type LoginType =
  | "ssh"
  | "system"
  | "webmail"
  | "smtp"
  | "imap"
  | "pop3"
  | "gui"
  | "https";

/**
 * IP Scope – pragmatische Union beider Backend-Versionen:
 * - schema.sql Enum: 'internal' | 'external' | 'docker' | 'loopback' | 'link_local' | 'unknown'
 * - ip_helper.py v3 liefert: 'localhost' | 'docker' | 'internal' | 'external' | 'unknown'
 * Beides wird unterstützt.
 */
export type IpScope =
  | "internal"
  | "external"
  | "docker"
  | "loopback"
  | "localhost"
  | "link_local"
  | "unknown";

export type BanStatus = "banning" | "unbanning";

export type IpStatus = "active" | "banned";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRIT";

// ============================================================
// Tabelle: security_events
// ============================================================

export interface SecurityEvent {
  id: number;
  event_time: string; // ISO datetime
  source_system: SourceSystem;
  source_component: SourceComponent | null;
  source_container: string | null;
  origin_system: string | null;
  decision_source: string | null;
  scenario_name: string | null;
  ip: string;
  ip_scope: IpScope | null;
  destination_port: number | null;
  destination_service: string | null;
  event_type: string;
  ban_status: BanStatus | null;
  alert_level: AlertLevel;
  target_email: string | null;
  attack_reason: string | null;
  raw_reason: string | null;
  normalized_reason: string | null;
  warning_type: string | null;
  hostname: string | null;
  request_path: string | null;
  http_method: string | null;
  http_status: number | null;
  user_agent: string | null;
  message: string;
  log_hash: string;
  imported_at: string;
}

// ============================================================
// Tabelle: auth_events
// ============================================================

export interface AuthEvent {
  id: number;
  event_time: string;
  source_system: SourceSystem;
  source_component: SourceComponent | null;
  source_container: string | null;
  login_type: LoginType;
  username: string | null;
  ip: string | null;
  ip_scope: IpScope | null;
  destination_port: number | null;
  destination_service: string | null;
  auth_status: AuthStatus;
  raw_reason: string | null;
  normalized_reason: string | null;
  alert_level: AlertLevel;
  hostname: string | null;
  request_path: string | null;
  http_method: string | null;
  http_status: number | null;
  user_agent: string | null;
  message: string;
  log_hash: string;
  imported_at: string;
}

// ============================================================
// Tabelle: ip_summary
// ============================================================

export interface IpSummary {
  ip: string;
  first_seen: string;
  last_seen: string;
  total_events: number;
  total_bans: number;
  total_unbans: number;
  total_auth_failures: number;
  total_auth_success: number;
  current_status: IpStatus;
  last_event_type: string | null;
  last_alert_level: AlertLevel | null;
  last_target_email: string | null;
  last_username: string | null;
  last_source_system: string | null;
  last_source_component: string | null;
  last_destination_port: number | null;
  last_destination_service: string | null;
  updated_at: string;
}

// ============================================================
// Tabelle: ip_risk_score (aus ip_risk_engine.py)
// ============================================================

export interface IpRiskScore {
  ip: string;
  score: number;
  risk_level: RiskLevel;
  auth_failures: number;
  auth_successes: number;
  security_events: number;
  bans: number;
  reasons: Record<string, number>; // JSON: { "BANNING": 3, "HTTP_PROBING": 5, ... }
  updated_at: string;
}

// ============================================================
// Tabelle: ip_risk_history
// ============================================================

export interface IpRiskHistory {
  id: number;
  ip: string;
  score: number;
  risk_level: RiskLevel;
  snapshot_time: string;
}

// ============================================================
// Tabelle: ip_daily_summary (aus daily_summary_builder.py)
// ============================================================

export interface IpDailySummary {
  ip: string;
  summary_date: string; // YYYY-MM-DD
  ip_scope: IpScope;
  total_events: number;
  security_events: number;
  auth_failed: number;
  auth_success: number;
  crit_events: number;
  warn_events: number;
  info_events: number;
  first_seen: string | null;
  last_seen: string | null;
  reasons: Record<string, number>; // JSON
  emails: Record<string, number>;  // JSON
}

// ============================================================
// Tabelle: ip_enrichment (aus ip_enricher.py)
// ============================================================

export interface IpEnrichment {
  ip: string;
  ip_scope: IpScope;
  country: string | null;     // ISO-2 z.B. "DE", "US"
  asn: string | null;         // z.B. "AS14618"
  org_name: string | null;    // z.B. "Amazon AWS"
  ptr: string | null;         // Reverse DNS
  last_lookup: string;
}

// ============================================================
// View: AggressiveIp – JOIN aus ip_summary + ip_enrichment + ip_risk_score
// ============================================================

/**
 * Repräsentiert das, was die FastAPI später als
 * GET /api/aggressive-ips?days=30 zurückliefern wird.
 * Ist ein JOIN aus drei Tabellen.
 */
export interface AggressiveIpView {
  // aus ip_summary
  ip: string;
  total_events: number;
  total_bans: number;
  total_auth_failures: number;
  current_status: IpStatus;
  last_seen: string;
  last_alert_level: AlertLevel | null;
  last_event_type: string | null;
  last_username: string | null;
  last_target_email: string | null;
  last_source_component: string | null;
  last_destination_port: number | null;
  last_destination_service: string | null;
  /** zuletzt gesehene Log-Message (aus security_events) */
  last_message: string | null;

  // aus ip_enrichment
  country: string | null;
  asn: string | null;
  org_name: string | null;
  ptr: string | null;

  // aus ip_risk_score
  risk_score: number;
  risk_level: RiskLevel;
}

// ============================================================
// View: InternalAuthProblemView – aggregiert aus auth_events
// ============================================================

export interface InternalAuthProblemView {
  ip: string;
  username: string;
  login_type: LoginType;
  failed_logins: number;
  last_seen: string;
  ip_scope: IpScope;
  // optional aus enrichment für interne Hostnamen
  hostname: string | null;
  destination_port: string; // z.B. "25/587"
}

// ============================================================
// View: CrowdSecAlertView – Filter auf security_events
// ============================================================

/**
 * CrowdSec-Alerts haben keine eigene Tabelle – sie werden in security_events
 * gespeichert mit source_system='opnsense' und gefülltem scenario_name.
 * Dieser View ist die kompakte Frontend-Sicht darauf.
 */
export interface CrowdSecAlertView {
  id: number;
  event_time: string;
  ip: string;
  scenario_name: string | null;
  normalized_reason: string | null;
  decision_source: string | null;
  alert_level: AlertLevel;
  http_method: string | null;
  request_path: string | null;
  http_status: number | null;
  user_agent: string | null;
}
