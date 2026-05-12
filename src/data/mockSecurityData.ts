// Mock data simulating LogCollector v2.9.3 output
// Strukturen entsprechen 1:1 dem MariaDB-Schema (siehe src/types/database.ts)
//
// HINWEIS: Die alten Interface-Aliase (SecurityEvent, AuthEvent, IPSummary, CrowdSecAlert,
// AggressiveIP30Days, InternalAuthProblem) bleiben als Re-Exports erhalten,
// damit bestehende Komponenten ohne Änderung weiterlaufen.

import type {
  SecurityEvent,
  AuthEvent,
  IpSummary,
  IpEnrichment,
  IpRiskScore,
  CrowdSecAlertView,
  AggressiveIpView,
  InternalAuthProblemView,
} from "@/types/database";

// ------------------------------------------------------------
// Backwards-compatible Type Aliases
// ------------------------------------------------------------
export type { SecurityEvent, AuthEvent, CrowdSecAlertView as CrowdSecAlert };
export type IPSummary = IpSummary;
export type AggressiveIP30Days = AggressiveIpView & {
  // Legacy-Felder (für UI-Kompatibilität – mappen auf neue Felder)
  treffer: number;
  level: string;
  quelle: string;
  grund: string;
  konto: string | null;
  letzte_meldung: string;
  organisation: string;
  land: string;
  ziel_port: string;
};
export type InternalAuthProblem = InternalAuthProblemView & {
  organisation: string;
  land: string;
  ptr: string;
  ziel_port: string;
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
const hours = (h: number) => {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
};

const days = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return dt.toISOString();
};

const fakeHash = (n: number) =>
  Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor((n * 9301 + 49297) % 233280 % 16)]).join("");

const now = new Date().toISOString();

// ------------------------------------------------------------
// Tabelle: security_events
// ------------------------------------------------------------
export const mockSecurityEvents: SecurityEvent[] = [
  {
    id: 1, event_time: hours(0.2), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Brute-force SMTP", raw_reason: "banning 185.234.72.14",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 185.234.72.14", log_hash: fakeHash(1), imported_at: now,
  },
  {
    id: 2, event_time: hours(0.5), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "45.141.84.91", ip_scope: "external", destination_port: 587, destination_service: "submission",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Repeated auth failures", raw_reason: "banning 45.141.84.91",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 45.141.84.91", log_hash: fakeHash(2), imported_at: now,
  },
  {
    id: 3, event_time: hours(1), source_system: "mailcow", source_component: "postfix",
    source_container: "postfix-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "91.240.118.172", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "reject", ban_status: null, alert_level: "INFO",
    target_email: "admin@example.com", attack_reason: "Reject", raw_reason: "reject from 91.240.118.172",
    normalized_reason: "REJECT", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "postfix: reject from 91.240.118.172", log_hash: fakeHash(3), imported_at: now,
  },
  {
    id: 4, event_time: hours(1.5), source_system: "mailcow", source_component: "postfix",
    source_container: "postfix-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "103.145.13.207", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "non_smtp_command", ban_status: null, alert_level: "WARN",
    target_email: null, attack_reason: "Non-SMTP Command", raw_reason: "non-smtp command",
    normalized_reason: "NON_SMTP_COMMAND", warning_type: "protocol_violation", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "postfix: non-smtp command from 103.145.13.207", log_hash: fakeHash(4), imported_at: now,
  },
  {
    id: 5, event_time: hours(2), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "unbanning 185.234.72.14",
    normalized_reason: "UNBANNING", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: unbanning 185.234.72.14", log_hash: fakeHash(5), imported_at: now,
  },
  {
    id: 6, event_time: hours(3), source_system: "mailcow", source_component: "dovecot",
    source_container: "dovecot-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "192.168.178.1", ip_scope: "internal", destination_port: 993, destination_service: "imaps",
    event_type: "authentication_failed", ban_status: null, alert_level: "WARN",
    target_email: "user@example.com", attack_reason: "Auth Failed", raw_reason: "auth failed",
    normalized_reason: "IMAP_AUTH_FAILED", warning_type: "auth_failure", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "dovecot: auth failed for user@example.com", log_hash: fakeHash(6), imported_at: now,
  },
  {
    id: 7, event_time: hours(4), source_system: "mailcow", source_component: "postfix",
    source_container: "postfix-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "77.247.110.58", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "authentication_failed", ban_status: null, alert_level: "WARN",
    target_email: "info@example.com", attack_reason: "Auth Failed", raw_reason: "SASL auth failed",
    normalized_reason: "SMTP_AUTH_FAILED", warning_type: "auth_failure", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "postfix: auth failed from 77.247.110.58", log_hash: fakeHash(7), imported_at: now,
  },
  {
    id: 8, event_time: hours(5), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "193.56.29.44", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Brute-force", raw_reason: "banning 193.56.29.44",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 193.56.29.44", log_hash: fakeHash(8), imported_at: now,
  },
  {
    id: 9, event_time: hours(6), source_system: "mailcow", source_component: "postfix",
    source_container: "postfix-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "5.188.206.14", ip_scope: "external", destination_port: 587, destination_service: "submission",
    event_type: "lost_connection_after_auth", ban_status: null, alert_level: "WARN",
    target_email: null, attack_reason: "Lost Connection", raw_reason: "lost connection after AUTH",
    normalized_reason: "LOST_CONNECTION_AFTER_AUTH", warning_type: "suspicious", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "postfix: lost connection after AUTH from 5.188.206.14", log_hash: fakeHash(9), imported_at: now,
  },
  {
    id: 10, event_time: hours(8), source_system: "mailcow", source_component: "postfix",
    source_container: "postfix-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "45.95.169.22", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "improper_command_pipelining", ban_status: null, alert_level: "WARN",
    target_email: null, attack_reason: "Command Pipelining", raw_reason: "improper command pipelining",
    normalized_reason: "IMPROPER_COMMAND_PIPELINING", warning_type: "protocol_violation", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "postfix: improper command pipelining from 45.95.169.22", log_hash: fakeHash(10), imported_at: now,
  },
  // CrowdSec/OPNsense events – source_system='opnsense' mit scenario_name
  {
    id: 11, event_time: hours(0.1), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/http-probing",
    ip: "194.26.29.113", ip_scope: "external", destination_port: 443, destination_service: "https",
    event_type: "ban", ban_status: "banning", alert_level: "WARN",
    target_email: null, attack_reason: null, raw_reason: "HTTP probing",
    normalized_reason: "HTTP_PROBING", warning_type: null, hostname: null,
    request_path: "/.env", http_method: "GET", http_status: 403, user_agent: "Mozilla/5.0",
    message: "crowdsec: ban 194.26.29.113 HTTP_PROBING", log_hash: fakeHash(11), imported_at: now,
  },
  {
    id: 12, event_time: hours(0.8), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/http-sensitive-files",
    ip: "162.142.125.40", ip_scope: "external", destination_port: 443, destination_service: "https",
    event_type: "ban", ban_status: "banning", alert_level: "WARN",
    target_email: null, attack_reason: null, raw_reason: "Sensitive files probe",
    normalized_reason: "HTTP_SENSITIVE_FILES", warning_type: null, hostname: null,
    request_path: "/wp-config.php", http_method: "GET", http_status: 404, user_agent: "python-requests/2.28",
    message: "crowdsec: ban 162.142.125.40 HTTP_SENSITIVE_FILES", log_hash: fakeHash(12), imported_at: now,
  },
  {
    id: 13, event_time: hours(1.5), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/http-admin-interface-probing",
    ip: "45.141.84.91", ip_scope: "external", destination_port: 443, destination_service: "https",
    event_type: "ban", ban_status: "banning", alert_level: "WARN",
    target_email: null, attack_reason: null, raw_reason: "Admin interface probe",
    normalized_reason: "HTTP_ADMIN_INTERFACE_PROBING", warning_type: null, hostname: null,
    request_path: "/admin/login", http_method: "POST", http_status: 403, user_agent: "curl/7.88",
    message: "crowdsec: ban 45.141.84.91 HTTP_ADMIN_INTERFACE_PROBING", log_hash: fakeHash(13), imported_at: now,
  },
  {
    id: 14, event_time: hours(3), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/jira_cve-2021-26086",
    ip: "185.234.72.14", ip_scope: "external", destination_port: 443, destination_service: "https",
    event_type: "ban", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: null, raw_reason: "Jira CVE-2021-26086",
    normalized_reason: "JIRA_CVE_2021_26086", warning_type: null, hostname: null,
    request_path: "/s/cfx/_/;/WEB-INF/web.xml", http_method: "GET", http_status: 403, user_agent: "Go-http-client/1.1",
    message: "crowdsec: ban 185.234.72.14 JIRA_CVE_2021_26086", log_hash: fakeHash(14), imported_at: now,
  },
  {
    id: 15, event_time: hours(5), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "firewallservices/pf-scan-multi_ports",
    ip: "193.56.29.44", ip_scope: "external", destination_port: null, destination_service: null,
    event_type: "ban", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: null, raw_reason: "Multi-port scan",
    normalized_reason: "PF_SCAN_MULTI_PORTS", warning_type: null, hostname: null,
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "crowdsec: ban 193.56.29.44 PF_SCAN_MULTI_PORTS", log_hash: fakeHash(15), imported_at: now,
  },
  {
    id: 16, event_time: hours(7), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/ssh-bf",
    ip: "89.248.163.200", ip_scope: "external", destination_port: 22, destination_service: "ssh",
    event_type: "ban", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: null, raw_reason: "SSH bruteforce",
    normalized_reason: "SSH_BRUTEFORCE", warning_type: null, hostname: null,
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "crowdsec: ban 89.248.163.200 SSH_BRUTEFORCE", log_hash: fakeHash(16), imported_at: now,
  },
  {
    id: 17, event_time: hours(10), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/http-probing",
    ip: "178.128.91.55", ip_scope: "external", destination_port: 443, destination_service: "https",
    event_type: "ban", ban_status: "banning", alert_level: "WARN",
    target_email: null, attack_reason: null, raw_reason: "HTTP probing",
    normalized_reason: "HTTP_PROBING", warning_type: null, hostname: null,
    request_path: "/phpmyadmin/", http_method: "GET", http_status: 404, user_agent: "DirBuster-1.0-RC1",
    message: "crowdsec: ban 178.128.91.55 HTTP_PROBING", log_hash: fakeHash(17), imported_at: now,
  },
  // ---- Historische Ban/Unban-Pärchen (für Ban-Timeline-Visualisierung) ----
  // 185.234.72.14: serieller Wiederholungstäter – 3 vergangene Ban-Spans + 1 aktiver Ban
  {
    id: 100, event_time: hours(168), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Brute-force SMTP", raw_reason: "banning 185.234.72.14",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 185.234.72.14 for 240 min", log_hash: fakeHash(100), imported_at: now,
  },
  {
    id: 101, event_time: hours(164), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "unbanning 185.234.72.14",
    normalized_reason: "UNBANNING", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: unbanning 185.234.72.14", log_hash: fakeHash(101), imported_at: now,
  },
  {
    id: 102, event_time: hours(120), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Brute-force SMTP", raw_reason: "banning 185.234.72.14",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 185.234.72.14 for 480 min", log_hash: fakeHash(102), imported_at: now,
  },
  {
    id: 103, event_time: hours(112), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "unbanning 185.234.72.14",
    normalized_reason: "UNBANNING", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: unbanning 185.234.72.14", log_hash: fakeHash(103), imported_at: now,
  },
  {
    id: 104, event_time: hours(72), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Brute-force SMTP", raw_reason: "banning 185.234.72.14",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 185.234.72.14 for 960 min", log_hash: fakeHash(104), imported_at: now,
  },
  {
    id: 105, event_time: hours(56), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "185.234.72.14", ip_scope: "external", destination_port: 25, destination_service: "smtp",
    event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "unbanning 185.234.72.14",
    normalized_reason: "UNBANNING", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: unbanning 185.234.72.14", log_hash: fakeHash(105), imported_at: now,
  },
  // 45.141.84.91: 2 Ban-Spans + aktueller Ban (ohne Unban → noch aktiv)
  {
    id: 110, event_time: hours(140), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "45.141.84.91", ip_scope: "external", destination_port: 587, destination_service: "submission",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Repeated auth failures", raw_reason: "banning 45.141.84.91",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 45.141.84.91", log_hash: fakeHash(110), imported_at: now,
  },
  {
    id: 111, event_time: hours(132), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "45.141.84.91", ip_scope: "external", destination_port: 587, destination_service: "submission",
    event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "unbanning 45.141.84.91",
    normalized_reason: "UNBANNING", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: unbanning 45.141.84.91", log_hash: fakeHash(111), imported_at: now,
  },
  {
    id: 112, event_time: hours(96), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "45.141.84.91", ip_scope: "external", destination_port: 587, destination_service: "submission",
    event_type: "banning", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: "Repeated auth failures", raw_reason: "banning 45.141.84.91",
    normalized_reason: "BANNING", warning_type: "brute_force", hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: banning 45.141.84.91", log_hash: fakeHash(112), imported_at: now,
  },
  {
    id: 113, event_time: hours(80), source_system: "mailcow", source_component: "netfilter",
    source_container: "netfilter-mailcow", origin_system: "mailcow", decision_source: null, scenario_name: null,
    ip: "45.141.84.91", ip_scope: "external", destination_port: 587, destination_service: "submission",
    event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "unbanning 45.141.84.91",
    normalized_reason: "UNBANNING", warning_type: null, hostname: "mail.example.com",
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "netfilter: unbanning 45.141.84.91", log_hash: fakeHash(113), imported_at: now,
  },
  // 89.248.163.200: 1 vergangener Ban + aktiver Ban (CrowdSec/SSH)
  {
    id: 120, event_time: hours(96), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/ssh-bf",
    ip: "89.248.163.200", ip_scope: "external", destination_port: 22, destination_service: "ssh",
    event_type: "ban", ban_status: "banning", alert_level: "CRIT",
    target_email: null, attack_reason: null, raw_reason: "SSH bruteforce",
    normalized_reason: "SSH_BRUTEFORCE", warning_type: null, hostname: null,
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "crowdsec: ban 89.248.163.200 SSH_BRUTEFORCE", log_hash: fakeHash(120), imported_at: now,
  },
  {
    id: 121, event_time: hours(72), source_system: "opnsense", source_component: "crowdsec",
    source_container: null, origin_system: "opnsense", decision_source: "crowdsec",
    scenario_name: "crowdsecurity/ssh-bf",
    ip: "89.248.163.200", ip_scope: "external", destination_port: 22, destination_service: "ssh",
    event_type: "unban", ban_status: "unbanning", alert_level: "INFO",
    target_email: null, attack_reason: null, raw_reason: "expired",
    normalized_reason: "UNBANNING", warning_type: null, hostname: null,
    request_path: null, http_method: null, http_status: null, user_agent: null,
    message: "crowdsec: unban 89.248.163.200 (decision expired)", log_hash: fakeHash(121), imported_at: now,
  },
];

// ------------------------------------------------------------
// Tabelle: auth_events
// ------------------------------------------------------------
const buildAuth = (
  id: number, h: number, comp: "postfix" | "dovecot", login: "smtp" | "imap",
  user: string, ip: string, port: number, service: string, scope: "external" | "internal" = "external"
): AuthEvent => ({
  id, event_time: hours(h), source_system: "mailcow", source_component: comp,
  source_container: `${comp}-mailcow`, login_type: login, username: user,
  ip, ip_scope: scope, destination_port: port, destination_service: service,
  auth_status: "failed", raw_reason: "SASL authentication failed",
  normalized_reason: login === "smtp" ? "SMTP_AUTH_FAILED" : "IMAP_AUTH_FAILED",
  alert_level: "WARN", hostname: "mail.example.com",
  request_path: null, http_method: null, http_status: null, user_agent: null,
  message: `${comp}: SASL auth failed for ${user} from ${ip}`,
  log_hash: fakeHash(id + 100), imported_at: now,
});

export const mockAuthEvents: AuthEvent[] = [
  buildAuth(1, 0.3, "postfix", "smtp", "admin@example.com", "185.234.72.14", 25, "smtp"),
  buildAuth(2, 0.7, "postfix", "smtp", "info@example.com", "45.141.84.91", 587, "submission"),
  buildAuth(3, 1.2, "dovecot", "imap", "user@example.com", "103.145.13.207", 993, "imaps"),
  buildAuth(4, 2.1, "postfix", "smtp", "admin@example.com", "185.234.72.14", 25, "smtp"),
  buildAuth(5, 3.5, "postfix", "smtp", "test@example.com", "77.247.110.58", 25, "smtp"),
  buildAuth(6, 4.2, "dovecot", "imap", "info@example.com", "5.188.206.14", 993, "imaps"),
  buildAuth(7, 5.8, "postfix", "smtp", "admin@example.com", "193.56.29.44", 587, "submission"),
  buildAuth(8, 7, "postfix", "smtp", "support@example.com", "45.95.169.22", 25, "smtp"),
  buildAuth(9, 9, "dovecot", "imap", "admin@example.com", "91.240.118.172", 993, "imaps"),
  buildAuth(10, 11, "postfix", "smtp", "billing@example.com", "185.234.72.14", 25, "smtp"),
  buildAuth(11, 14, "postfix", "smtp", "admin@example.com", "45.141.84.91", 587, "submission"),
  buildAuth(12, 18, "dovecot", "imap", "user@example.com", "103.145.13.207", 993, "imaps"),
];

// ------------------------------------------------------------
// Tabelle: ip_summary
// ------------------------------------------------------------
export const mockIPSummary: IpSummary[] = [
  { ip: "185.234.72.14", first_seen: hours(48), last_seen: hours(0.2), total_events: 47, total_bans: 5, total_unbans: 4, total_auth_failures: 38, total_auth_success: 0, current_status: "banned", last_event_type: "banning", last_alert_level: "CRIT", last_target_email: "admin@example.com", last_username: "admin@example.com", last_source_system: "mailcow", last_source_component: "netfilter", last_destination_port: 25, last_destination_service: "smtp", updated_at: now },
  { ip: "45.141.84.91", first_seen: hours(36), last_seen: hours(0.5), total_events: 31, total_bans: 3, total_unbans: 2, total_auth_failures: 26, total_auth_success: 0, current_status: "banned", last_event_type: "banning", last_alert_level: "CRIT", last_target_email: "info@example.com", last_username: "info@example.com", last_source_system: "mailcow", last_source_component: "netfilter", last_destination_port: 587, last_destination_service: "submission", updated_at: now },
  { ip: "193.56.29.44", first_seen: hours(24), last_seen: hours(5), total_events: 22, total_bans: 2, total_unbans: 1, total_auth_failures: 19, total_auth_success: 0, current_status: "banned", last_event_type: "banning", last_alert_level: "CRIT", last_target_email: null, last_username: null, last_source_system: "mailcow", last_source_component: "netfilter", last_destination_port: 25, last_destination_service: "smtp", updated_at: now },
  { ip: "103.145.13.207", first_seen: hours(20), last_seen: hours(1.5), total_events: 15, total_bans: 0, total_unbans: 0, total_auth_failures: 12, total_auth_success: 0, current_status: "active", last_event_type: "non_smtp_command", last_alert_level: "WARN", last_target_email: null, last_username: "user@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp", updated_at: now },
  { ip: "77.247.110.58", first_seen: hours(12), last_seen: hours(4), total_events: 9, total_bans: 0, total_unbans: 0, total_auth_failures: 9, total_auth_success: 0, current_status: "active", last_event_type: "authentication_failed", last_alert_level: "WARN", last_target_email: "info@example.com", last_username: "test@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp", updated_at: now },
  { ip: "91.240.118.172", first_seen: hours(10), last_seen: hours(1), total_events: 7, total_bans: 0, total_unbans: 0, total_auth_failures: 3, total_auth_success: 0, current_status: "active", last_event_type: "reject", last_alert_level: "INFO", last_target_email: "admin@example.com", last_username: "admin@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp", updated_at: now },
  { ip: "5.188.206.14", first_seen: hours(8), last_seen: hours(6), total_events: 5, total_bans: 0, total_unbans: 0, total_auth_failures: 4, total_auth_success: 0, current_status: "active", last_event_type: "lost_connection_after_auth", last_alert_level: "WARN", last_target_email: null, last_username: "info@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 587, last_destination_service: "submission", updated_at: now },
  { ip: "45.95.169.22", first_seen: hours(8), last_seen: hours(8), total_events: 3, total_bans: 0, total_unbans: 0, total_auth_failures: 1, total_auth_success: 0, current_status: "active", last_event_type: "improper_command_pipelining", last_alert_level: "WARN", last_target_email: null, last_username: "support@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp", updated_at: now },
];

// ------------------------------------------------------------
// Tabelle: ip_enrichment (NEU – aus ip_enricher.py)
// ------------------------------------------------------------
export const mockIPEnrichment: IpEnrichment[] = [
  { ip: "185.234.72.14", ip_scope: "external", country: "RU", asn: "AS50113", org_name: "OOO Network of data-centers Selectel", ptr: null, last_lookup: now },
  { ip: "45.141.84.91", ip_scope: "external", country: "RU", asn: "AS204428", org_name: "SS-Net", ptr: null, last_lookup: now },
  { ip: "193.56.29.44", ip_scope: "external", country: "UA", asn: "AS56655", org_name: "TerraHost AS", ptr: null, last_lookup: now },
  { ip: "103.145.13.207", ip_scope: "external", country: "BD", asn: "AS135335", org_name: "Skylink Internet Services", ptr: null, last_lookup: now },
  { ip: "77.247.110.58", ip_scope: "external", country: "NL", asn: "AS49870", org_name: "Alsycon B.V.", ptr: null, last_lookup: now },
  { ip: "91.240.118.172", ip_scope: "external", country: "GB", asn: "AS204957", org_name: "Sysoev Aleksey Nikolaevich", ptr: null, last_lookup: now },
  { ip: "5.188.206.14", ip_scope: "external", country: "EE", asn: "AS49505", org_name: "EstNOC OY", ptr: null, last_lookup: now },
  { ip: "45.95.169.22", ip_scope: "external", country: "NL", asn: "AS210644", org_name: "AEZA INTERNATIONAL LTD", ptr: null, last_lookup: now },
  { ip: "194.26.29.113", ip_scope: "external", country: "RU", asn: "AS49505", org_name: "Selectel", ptr: null, last_lookup: now },
  { ip: "162.142.125.40", ip_scope: "external", country: "US", asn: "AS398324", org_name: "Censys, Inc.", ptr: "scanner.censys.io", last_lookup: now },
  { ip: "89.248.163.200", ip_scope: "external", country: "NL", asn: "AS202425", org_name: "IP Volume inc", ptr: "scanner.censys.io", last_lookup: now },
  { ip: "178.128.91.55", ip_scope: "external", country: "DE", asn: "AS14061", org_name: "DigitalOcean LLC", ptr: null, last_lookup: now },
  { ip: "18.218.118.203", ip_scope: "external", country: "US", asn: "AS16509", org_name: "Amazon AWS", ptr: null, last_lookup: now },
  { ip: "134.209.244.59", ip_scope: "external", country: "NL", asn: "AS14061", org_name: "DigitalOcean LLC", ptr: null, last_lookup: now },
  { ip: "3.131.220.121", ip_scope: "external", country: "US", asn: "AS16509", org_name: "Amazon AWS", ptr: null, last_lookup: now },
  { ip: "18.116.101.220", ip_scope: "external", country: "US", asn: "AS16509", org_name: "Amazon AWS", ptr: null, last_lookup: now },
  { ip: "34.193.119.44", ip_scope: "external", country: "US", asn: "AS14618", org_name: "Amazon AWS", ptr: null, last_lookup: now },
  { ip: "3.129.187.38", ip_scope: "external", country: "US", asn: "AS16509", org_name: "Amazon AWS (us-east-2)", ptr: null, last_lookup: now },
  { ip: "81.19.216.85", ip_scope: "external", country: "RU", asn: "AS41682", org_name: "PJSC Rostelecom", ptr: null, last_lookup: now },
  { ip: "89.21.67.184", ip_scope: "external", country: "DE", asn: "AS8881", org_name: "1&1 Versatel Deutschland", ptr: null, last_lookup: now },
  { ip: "5.255.118.182", ip_scope: "external", country: "RU", asn: "AS13238", org_name: "Yandex.Cloud LLC", ptr: null, last_lookup: now },
  { ip: "80.187.82.22", ip_scope: "external", country: "DE", asn: "AS3320", org_name: "Deutsche Telekom AG", ptr: null, last_lookup: now },
];

// ------------------------------------------------------------
// Tabelle: ip_risk_score (NEU – aus ip_risk_engine.py)
// ------------------------------------------------------------
export const mockIPRiskScore: IpRiskScore[] = [
  { ip: "185.234.72.14", score: 178, risk_level: "CRIT", auth_failures: 38, auth_successes: 0, security_events: 47, bans: 5, reasons: { BANNING: 50, SMTP_AUTH_FAILED: 76, JIRA_CVE_2021_26086: 8 }, updated_at: now },
  { ip: "45.141.84.91", score: 142, risk_level: "HIGH", auth_failures: 26, auth_successes: 0, security_events: 31, bans: 3, reasons: { BANNING: 30, SMTP_AUTH_FAILED: 52, HTTP_ADMIN_INTERFACE_PROBING: 5 }, updated_at: now },
  { ip: "193.56.29.44", score: 118, risk_level: "HIGH", auth_failures: 19, auth_successes: 0, security_events: 22, bans: 2, reasons: { BANNING: 20, SMTP_AUTH_FAILED: 38, PF_SCAN_MULTI_PORTS: 6 }, updated_at: now },
  { ip: "89.248.163.200", score: 95, risk_level: "MEDIUM", auth_failures: 0, auth_successes: 0, security_events: 33, bans: 1, reasons: { SSH_BRUTEFORCE: 33 }, updated_at: now },
  { ip: "103.145.13.207", score: 51, risk_level: "MEDIUM", auth_failures: 12, auth_successes: 0, security_events: 15, bans: 0, reasons: { IMAP_AUTH_FAILED: 24, NON_SMTP_COMMAND: 9 }, updated_at: now },
  { ip: "77.247.110.58", score: 32, risk_level: "LOW", auth_failures: 9, auth_successes: 0, security_events: 9, bans: 0, reasons: { SMTP_AUTH_FAILED: 18 }, updated_at: now },
  { ip: "91.240.118.172", score: 18, risk_level: "LOW", auth_failures: 3, auth_successes: 0, security_events: 7, bans: 0, reasons: { REJECT: 7, IMAP_AUTH_FAILED: 6 }, updated_at: now },
  { ip: "5.188.206.14", score: 14, risk_level: "LOW", auth_failures: 4, auth_successes: 0, security_events: 5, bans: 0, reasons: { LOST_CONNECTION_AFTER_AUTH: 5, SMTP_AUTH_FAILED: 8 }, updated_at: now },
  { ip: "45.95.169.22", score: 8, risk_level: "LOW", auth_failures: 1, auth_successes: 0, security_events: 3, bans: 0, reasons: { IMPROPER_COMMAND_PIPELINING: 6 }, updated_at: now },
  { ip: "162.142.125.40", score: 21, risk_level: "LOW", auth_failures: 0, auth_successes: 0, security_events: 21, bans: 1, reasons: { HTTP_PROBING: 15, HTTP_SENSITIVE_FILES: 5 }, updated_at: now },
  { ip: "194.26.29.113", score: 12, risk_level: "LOW", auth_failures: 0, auth_successes: 0, security_events: 12, bans: 1, reasons: { HTTP_PROBING: 12 }, updated_at: now },
  { ip: "178.128.91.55", score: 9, risk_level: "LOW", auth_failures: 0, auth_successes: 0, security_events: 9, bans: 1, reasons: { HTTP_PROBING: 9 }, updated_at: now },
  { ip: "18.218.118.203", score: 117, risk_level: "HIGH", auth_failures: 0, auth_successes: 0, security_events: 117, bans: 4, reasons: { WARNING: 60, BANNING: 40 }, updated_at: now },
  { ip: "134.209.244.59", score: 10, risk_level: "LOW", auth_failures: 0, auth_successes: 0, security_events: 10, bans: 0, reasons: { IMPROPER_COMMAND_PIPELINING: 10 }, updated_at: now },
  { ip: "3.131.220.121", score: 12, risk_level: "LOW", auth_failures: 0, auth_successes: 0, security_events: 12, bans: 0, reasons: { NON_SMTP_COMMAND: 12 }, updated_at: now },
  { ip: "18.116.101.220", score: 62, risk_level: "MEDIUM", auth_failures: 0, auth_successes: 0, security_events: 62, bans: 2, reasons: { UNBANNING: 30, BANNING: 20 }, updated_at: now },
  { ip: "34.193.119.44", score: 15, risk_level: "LOW", auth_failures: 0, auth_successes: 0, security_events: 15, bans: 0, reasons: { WARNING: 15 }, updated_at: now },
];

// ------------------------------------------------------------
// View: CrowdSec Alerts (abgeleitet aus security_events)
// ------------------------------------------------------------
export const mockCrowdSecAlerts: CrowdSecAlertView[] = mockSecurityEvents
  .filter((e) => e.source_system === "opnsense" && e.scenario_name)
  .map((e) => ({
    id: e.id,
    event_time: e.event_time,
    ip: e.ip,
    scenario_name: e.scenario_name,
    normalized_reason: e.normalized_reason,
    decision_source: e.decision_source,
    alert_level: e.alert_level,
    http_method: e.http_method,
    request_path: e.request_path,
    http_status: e.http_status,
    user_agent: e.user_agent,
  }));

// Legacy-Kompat: alte Property-Namen für CrowdSecAlerts-Komponente
// (sie liest noch a.scenario, a.decision_type)
export const mockCrowdSecAlertsLegacy = mockCrowdSecAlerts.map((a) => ({
  ...a,
  scenario: a.scenario_name,
  decision_type: a.decision_source ?? "ban",
}));

// ------------------------------------------------------------
// View: Aggressive IPs 30 Days (JOIN ip_summary × ip_enrichment × ip_risk_score)
// ------------------------------------------------------------
type LegacyAgg = AggressiveIpView & {
  treffer: number; level: string; quelle: string; grund: string;
  konto: string | null; letzte_meldung: string;
  organisation: string; land: string; ziel_port: string;
};

const buildAggressiveIPs = (): LegacyAgg[] => {
  // Quelldaten (entspricht später WHERE last_seen > NOW() - INTERVAL 30 DAY)
  const seed: Array<{
    ip: string; total_events: number; total_bans: number; total_auth_failures: number;
    last_seen: string; alert_level: "CRIT" | "WARN" | "INFO";
    component: string; event_type: string; username: string | null; target_email: string | null;
    port: number | null; service: string | null; message: string;
  }> = [
    { ip: "18.218.118.203", total_events: 117, total_bans: 4, total_auth_failures: 0, last_seen: days(0), alert_level: "WARN", component: "postfix", event_type: "warning", username: null, target_email: null, port: 25, service: "smtp", message: "CRIT: Banning 18.218.118.203/32 for 960 minutes" },
    { ip: "134.209.244.59", total_events: 10, total_bans: 0, total_auth_failures: 0, last_seen: days(1), alert_level: "WARN", component: "postfix", event_type: "improper_command_pipelining", username: null, target_email: null, port: 587, service: "submission", message: "postfix/submission/smtpd[50857]: improper command pipelining after CONNECT" },
    { ip: "3.131.220.121", total_events: 12, total_bans: 0, total_auth_failures: 0, last_seen: days(1), alert_level: "WARN", component: "postfix", event_type: "non_smtp_command", username: null, target_email: null, port: 25, service: "smtp", message: "INFO: Unbanning 3.131.220.121/32" },
    { ip: "18.116.101.220", total_events: 62, total_bans: 2, total_auth_failures: 0, last_seen: days(2), alert_level: "WARN", component: "postfix", event_type: "unbanning", username: null, target_email: null, port: 25, service: "smtp", message: "INFO: Unbanning 18.116.101.220/32" },
    { ip: "34.193.119.44", total_events: 15, total_bans: 0, total_auth_failures: 0, last_seen: days(2), alert_level: "WARN", component: "postfix", event_type: "unbanning", username: null, target_email: null, port: 587, service: "submission", message: "WARN: 34.193.119.44 matched rule id 4" },
    { ip: "45.141.84.91", total_events: 89, total_bans: 3, total_auth_failures: 26, last_seen: days(3), alert_level: "CRIT", component: "netfilter", event_type: "banning", username: "info@example.com", target_email: "info@example.com", port: 587, service: "submission", message: "netfilter: banning 45.141.84.91 for brute-force SMTP" },
    { ip: "193.56.29.44", total_events: 45, total_bans: 2, total_auth_failures: 19, last_seen: days(5), alert_level: "CRIT", component: "netfilter", event_type: "banning", username: null, target_email: null, port: 993, service: "imaps", message: "netfilter: banning 193.56.29.44 - repeated auth failures" },
    { ip: "89.248.163.200", total_events: 33, total_bans: 1, total_auth_failures: 0, last_seen: days(7), alert_level: "CRIT", component: "crowdsec", event_type: "ssh_bruteforce", username: null, target_email: null, port: 22, service: "ssh", message: "crowdsec: ban 89.248.163.200 SSH bruteforce" },
    { ip: "162.142.125.40", total_events: 21, total_bans: 1, total_auth_failures: 0, last_seen: days(10), alert_level: "WARN", component: "crowdsec", event_type: "http_probing", username: null, target_email: null, port: 443, service: "https", message: "crowdsec: ban 162.142.125.40 HTTP sensitive files" },
    { ip: "5.188.206.14", total_events: 18, total_bans: 0, total_auth_failures: 4, last_seen: days(14), alert_level: "WARN", component: "postfix", event_type: "lost_connection_after_auth", username: null, target_email: null, port: 587, service: "submission", message: "postfix: lost connection after AUTH from 5.188.206.14" },
  ];

  return seed.map((s): LegacyAgg => {
    const enrich = mockIPEnrichment.find((e) => e.ip === s.ip);
    const risk = mockIPRiskScore.find((r) => r.ip === s.ip);
    return {
      // AggressiveIpView
      ip: s.ip,
      total_events: s.total_events,
      total_bans: s.total_bans,
      total_auth_failures: s.total_auth_failures,
      current_status: s.total_bans > 0 ? "banned" : "active",
      last_seen: s.last_seen,
      last_alert_level: s.alert_level,
      last_event_type: s.event_type,
      last_username: s.username,
      last_target_email: s.target_email,
      last_source_component: s.component,
      last_destination_port: s.port,
      last_destination_service: s.service,
      last_message: s.message,
      country: enrich?.country ?? null,
      asn: enrich?.asn ?? null,
      org_name: enrich?.org_name ?? null,
      ptr: enrich?.ptr ?? null,
      risk_score: risk?.score ?? 0,
      risk_level: risk?.risk_level ?? "LOW",

      // Legacy-Kompat-Felder
      treffer: s.total_events,
      level: s.alert_level,
      quelle: s.component,
      grund: s.event_type,
      konto: s.username,
      letzte_meldung: s.message,
      organisation: enrich?.org_name ?? "unbekannt",
      land: enrich?.country ?? "??",
      ziel_port: s.port ? `${s.port}` : "-",
    };
  });
};

export const mockAggressiveIPs30Days: LegacyAgg[] = buildAggressiveIPs();

// ------------------------------------------------------------
// View: Internal Auth Problems (30 Days)
// ------------------------------------------------------------
export const mockInternalAuthProblems: InternalAuthProblem[] = [
  { ip: "172.22.1.13", failed_logins: 14962, username: "watchdog@invalid", login_type: "smtp", last_seen: days(0), ip_scope: "docker", hostname: "watchdog.local", destination_port: "25", organisation: "intern", land: "DE", ptr: "watchdog.local", ziel_port: "25" },
  { ip: "192.168.3.108", failed_logins: 1056, username: "info@servuswir.de", login_type: "smtp", last_seen: days(2), ip_scope: "internal", hostname: "nas.local", destination_port: "587", organisation: "intern", land: "DE", ptr: "nas.local", ziel_port: "587" },
  { ip: "192.168.1.50", failed_logins: 312, username: "admin@example.com", login_type: "imap", last_seen: days(1), ip_scope: "internal", hostname: "desktop-pc.local", destination_port: "993", organisation: "intern", land: "DE", ptr: "desktop-pc.local", ziel_port: "993" },
  { ip: "10.0.0.25", failed_logins: 89, username: "backup@example.com", login_type: "smtp", last_seen: days(5), ip_scope: "internal", hostname: "backup-srv.local", destination_port: "25/587", organisation: "intern", land: "DE", ptr: "backup-srv.local", ziel_port: "25/587" },
  { ip: "172.22.1.100", failed_logins: 45, username: "scanner@internal", login_type: "smtp", last_seen: days(8), ip_scope: "docker", hostname: "scanner.local", destination_port: "587", organisation: "intern", land: "DE", ptr: "scanner.local", ziel_port: "587" },
];

// ------------------------------------------------------------
// Timeline data for charts (auth failures per hour, last 24h)
// ------------------------------------------------------------
export const authFailureTimeline = Array.from({ length: 24 }, (_, i) => {
  const h = 23 - i;
  const d = new Date();
  d.setHours(d.getHours() - h, 0, 0, 0);
  const counts: Record<string, number> = { smtp: 0, imap: 0 };
  mockAuthEvents.forEach((e) => {
    const eH = Math.floor((Date.now() - new Date(e.event_time).getTime()) / 3600000);
    if (eH === h) {
      if (e.login_type === "smtp") counts.smtp++;
      else counts.imap++;
    }
  });
  const base = Math.max(0, Math.floor(Math.random() * 5) + (h < 6 ? 3 : h < 12 ? 7 : 4));
  return {
    hour: `${d.getHours().toString().padStart(2, "0")}:00`,
    smtp: counts.smtp + base + Math.floor(Math.random() * 4),
    imap: counts.imap + Math.floor(base * 0.4),
  };
});

// ------------------------------------------------------------
// Events per source (with time comparisons)
// ------------------------------------------------------------
export const eventsBySource = [
  { source: "Postfix", h24: 42, d7: 189, d30: 623, fill: "hsl(0 84% 60%)", fillMid: "hsl(0 84% 45%)", fillLight: "hsl(0 84% 32%)" },
  { source: "Netfilter", h24: 28, d7: 134, d30: 487, fill: "hsl(38 92% 50%)", fillMid: "hsl(38 92% 38%)", fillLight: "hsl(38 92% 26%)" },
  { source: "Dovecot", h24: 15, d7: 78, d30: 245, fill: "hsl(217 91% 60%)", fillMid: "hsl(217 91% 45%)", fillLight: "hsl(217 91% 32%)" },
  { source: "CrowdSec", h24: 7, d7: 41, d30: 156, fill: "hsl(142 71% 45%)", fillMid: "hsl(142 71% 33%)", fillLight: "hsl(142 71% 22%)" },
];
