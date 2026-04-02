// Mock data simulating LogCollector v2.9.3 output

export interface SecurityEvent {
  id: number;
  event_time: string;
  source_system: string;
  source_component: string;
  ip: string;
  destination_port: number | null;
  destination_service: string | null;
  event_type: string;
  ban_status: string | null;
  alert_level: string;
  target_email: string | null;
  attack_reason: string | null;
  message: string;
  warning_type: string | null;
}

export interface AuthEvent {
  id: number;
  event_time: string;
  source_system: string;
  source_component: string;
  login_type: string;
  username: string;
  ip: string;
  destination_port: number;
  destination_service: string;
  auth_status: string;
  alert_level: string;
  message: string;
}

export interface IPSummary {
  ip: string;
  first_seen: string;
  last_seen: string;
  total_events: number;
  total_bans: number;
  total_unbans: number;
  total_auth_failures: number;
  current_status: string;
  last_event_type: string;
  last_alert_level: string;
  last_target_email: string | null;
  last_username: string | null;
  last_source_system: string;
  last_source_component: string;
  last_destination_port: number | null;
  last_destination_service: string | null;
}

export interface CrowdSecAlert {
  id: number;
  event_time: string;
  ip: string;
  scenario: string;
  normalized_reason: string;
  decision_type: string;
  alert_level: string;
  http_method: string | null;
  request_path: string | null;
  http_status: number | null;
  user_agent: string | null;
}

// Helper
const hours = (h: number) => {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
};

export const mockSecurityEvents: SecurityEvent[] = [
  { id: 1, event_time: hours(0.2), source_system: "mailcow", source_component: "netfilter", ip: "185.234.72.14", destination_port: 25, destination_service: "smtp", event_type: "banning", ban_status: "banning", alert_level: "CRIT", target_email: null, attack_reason: "Brute-force SMTP", message: "netfilter: banning 185.234.72.14", warning_type: "brute_force" },
  { id: 2, event_time: hours(0.5), source_system: "mailcow", source_component: "netfilter", ip: "45.141.84.91", destination_port: 587, destination_service: "submission", event_type: "banning", ban_status: "banning", alert_level: "CRIT", target_email: null, attack_reason: "Repeated auth failures", message: "netfilter: banning 45.141.84.91", warning_type: "brute_force" },
  { id: 3, event_time: hours(1), source_system: "mailcow", source_component: "postfix", ip: "91.240.118.172", destination_port: 25, destination_service: "smtp", event_type: "reject", ban_status: null, alert_level: "INFO", target_email: "admin@example.com", attack_reason: "Reject", message: "postfix: reject from 91.240.118.172", warning_type: null },
  { id: 4, event_time: hours(1.5), source_system: "mailcow", source_component: "postfix", ip: "103.145.13.207", destination_port: 25, destination_service: "smtp", event_type: "non_smtp_command", ban_status: null, alert_level: "WARN", target_email: null, attack_reason: "Non-SMTP Command", message: "postfix: non-smtp command from 103.145.13.207", warning_type: "protocol_violation" },
  { id: 5, event_time: hours(2), source_system: "mailcow", source_component: "netfilter", ip: "185.234.72.14", destination_port: 25, destination_service: "smtp", event_type: "unbanning", ban_status: "unbanning", alert_level: "INFO", target_email: null, attack_reason: null, message: "netfilter: unbanning 185.234.72.14", warning_type: null },
  { id: 6, event_time: hours(3), source_system: "mailcow", source_component: "dovecot", ip: "192.168.178.1", destination_port: 993, destination_service: "imaps", event_type: "authentication_failed", ban_status: null, alert_level: "WARN", target_email: "user@example.com", attack_reason: "Auth Failed", message: "dovecot: auth failed for user@example.com", warning_type: "auth_failure" },
  { id: 7, event_time: hours(4), source_system: "mailcow", source_component: "postfix", ip: "77.247.110.58", destination_port: 25, destination_service: "smtp", event_type: "authentication_failed", ban_status: null, alert_level: "WARN", target_email: "info@example.com", attack_reason: "Auth Failed", message: "postfix: auth failed from 77.247.110.58", warning_type: "auth_failure" },
  { id: 8, event_time: hours(5), source_system: "mailcow", source_component: "netfilter", ip: "193.56.29.44", destination_port: 25, destination_service: "smtp", event_type: "banning", ban_status: "banning", alert_level: "CRIT", target_email: null, attack_reason: "Brute-force", message: "netfilter: banning 193.56.29.44", warning_type: "brute_force" },
  { id: 9, event_time: hours(6), source_system: "mailcow", source_component: "postfix", ip: "5.188.206.14", destination_port: 587, destination_service: "submission", event_type: "lost_connection_after_auth", ban_status: null, alert_level: "WARN", target_email: null, attack_reason: "Lost Connection", message: "postfix: lost connection after AUTH from 5.188.206.14", warning_type: "suspicious" },
  { id: 10, event_time: hours(8), source_system: "mailcow", source_component: "postfix", ip: "45.95.169.22", destination_port: 25, destination_service: "smtp", event_type: "improper_command_pipelining", ban_status: null, alert_level: "WARN", target_email: null, attack_reason: "Command Pipelining", message: "postfix: improper command pipelining from 45.95.169.22", warning_type: "protocol_violation" },
];

export const mockAuthEvents: AuthEvent[] = [
  { id: 1, event_time: hours(0.3), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "admin@example.com", ip: "185.234.72.14", destination_port: 25, destination_service: "smtp", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 2, event_time: hours(0.7), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "info@example.com", ip: "45.141.84.91", destination_port: 587, destination_service: "submission", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 3, event_time: hours(1.2), source_system: "mailcow", source_component: "dovecot", login_type: "imap", username: "user@example.com", ip: "103.145.13.207", destination_port: 993, destination_service: "imaps", auth_status: "failed", alert_level: "WARN", message: "Auth failed IMAP" },
  { id: 4, event_time: hours(2.1), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "admin@example.com", ip: "185.234.72.14", destination_port: 25, destination_service: "smtp", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 5, event_time: hours(3.5), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "test@example.com", ip: "77.247.110.58", destination_port: 25, destination_service: "smtp", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 6, event_time: hours(4.2), source_system: "mailcow", source_component: "dovecot", login_type: "imap", username: "info@example.com", ip: "5.188.206.14", destination_port: 993, destination_service: "imaps", auth_status: "failed", alert_level: "WARN", message: "Auth failed IMAP" },
  { id: 7, event_time: hours(5.8), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "admin@example.com", ip: "193.56.29.44", destination_port: 587, destination_service: "submission", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 8, event_time: hours(7), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "support@example.com", ip: "45.95.169.22", destination_port: 25, destination_service: "smtp", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 9, event_time: hours(9), source_system: "mailcow", source_component: "dovecot", login_type: "imap", username: "admin@example.com", ip: "91.240.118.172", destination_port: 993, destination_service: "imaps", auth_status: "failed", alert_level: "WARN", message: "Auth failed IMAP" },
  { id: 10, event_time: hours(11), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "billing@example.com", ip: "185.234.72.14", destination_port: 25, destination_service: "smtp", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 11, event_time: hours(14), source_system: "mailcow", source_component: "postfix", login_type: "smtp", username: "admin@example.com", ip: "45.141.84.91", destination_port: 587, destination_service: "submission", auth_status: "failed", alert_level: "WARN", message: "SASL auth failed" },
  { id: 12, event_time: hours(18), source_system: "mailcow", source_component: "dovecot", login_type: "imap", username: "user@example.com", ip: "103.145.13.207", destination_port: 993, destination_service: "imaps", auth_status: "failed", alert_level: "WARN", message: "Auth failed IMAP" },
];

export const mockIPSummary: IPSummary[] = [
  { ip: "185.234.72.14", first_seen: hours(48), last_seen: hours(0.2), total_events: 47, total_bans: 5, total_unbans: 4, total_auth_failures: 38, current_status: "banned", last_event_type: "banning", last_alert_level: "CRIT", last_target_email: "admin@example.com", last_username: "admin@example.com", last_source_system: "mailcow", last_source_component: "netfilter", last_destination_port: 25, last_destination_service: "smtp" },
  { ip: "45.141.84.91", first_seen: hours(36), last_seen: hours(0.5), total_events: 31, total_bans: 3, total_unbans: 2, total_auth_failures: 26, current_status: "banned", last_event_type: "banning", last_alert_level: "CRIT", last_target_email: "info@example.com", last_username: "info@example.com", last_source_system: "mailcow", last_source_component: "netfilter", last_destination_port: 587, last_destination_service: "submission" },
  { ip: "193.56.29.44", first_seen: hours(24), last_seen: hours(5), total_events: 22, total_bans: 2, total_unbans: 1, total_auth_failures: 19, current_status: "banned", last_event_type: "banning", last_alert_level: "CRIT", last_target_email: null, last_username: null, last_source_system: "mailcow", last_source_component: "netfilter", last_destination_port: 25, last_destination_service: "smtp" },
  { ip: "103.145.13.207", first_seen: hours(20), last_seen: hours(1.5), total_events: 15, total_bans: 0, total_unbans: 0, total_auth_failures: 12, current_status: "active", last_event_type: "non_smtp_command", last_alert_level: "WARN", last_target_email: null, last_username: "user@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp" },
  { ip: "77.247.110.58", first_seen: hours(12), last_seen: hours(4), total_events: 9, total_bans: 0, total_unbans: 0, total_auth_failures: 9, current_status: "active", last_event_type: "authentication_failed", last_alert_level: "WARN", last_target_email: "info@example.com", last_username: "test@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp" },
  { ip: "91.240.118.172", first_seen: hours(10), last_seen: hours(1), total_events: 7, total_bans: 0, total_unbans: 0, total_auth_failures: 3, current_status: "active", last_event_type: "reject", last_alert_level: "INFO", last_target_email: "admin@example.com", last_username: "admin@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp" },
  { ip: "5.188.206.14", first_seen: hours(8), last_seen: hours(6), total_events: 5, total_bans: 0, total_unbans: 0, total_auth_failures: 4, current_status: "active", last_event_type: "lost_connection_after_auth", last_alert_level: "WARN", last_target_email: null, last_username: "info@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 587, last_destination_service: "submission" },
  { ip: "45.95.169.22", first_seen: hours(8), last_seen: hours(8), total_events: 3, total_bans: 0, total_unbans: 0, total_auth_failures: 1, current_status: "active", last_event_type: "improper_command_pipelining", last_alert_level: "WARN", last_target_email: null, last_username: "support@example.com", last_source_system: "mailcow", last_source_component: "postfix", last_destination_port: 25, last_destination_service: "smtp" },
];

export const mockCrowdSecAlerts: CrowdSecAlert[] = [
  { id: 1, event_time: hours(0.1), ip: "194.26.29.113", scenario: "crowdsecurity/http-probing", normalized_reason: "HTTP_PROBING", decision_type: "ban", alert_level: "WARN", http_method: "GET", request_path: "/.env", http_status: 403, user_agent: "Mozilla/5.0" },
  { id: 2, event_time: hours(0.8), ip: "162.142.125.40", scenario: "crowdsecurity/http-sensitive-files", normalized_reason: "HTTP_SENSITIVE_FILES", decision_type: "ban", alert_level: "WARN", http_method: "GET", request_path: "/wp-config.php", http_status: 404, user_agent: "python-requests/2.28" },
  { id: 3, event_time: hours(1.5), ip: "45.141.84.91", scenario: "crowdsecurity/http-admin-interface-probing", normalized_reason: "HTTP_ADMIN_INTERFACE_PROBING", decision_type: "ban", alert_level: "WARN", http_method: "POST", request_path: "/admin/login", http_status: 403, user_agent: "curl/7.88" },
  { id: 4, event_time: hours(3), ip: "185.234.72.14", scenario: "crowdsecurity/jira_cve-2021-26086", normalized_reason: "JIRA_CVE_2021_26086", decision_type: "ban", alert_level: "CRIT", http_method: "GET", request_path: "/s/cfx/_/;/WEB-INF/web.xml", http_status: 403, user_agent: "Go-http-client/1.1" },
  { id: 5, event_time: hours(5), ip: "193.56.29.44", scenario: "firewallservices/pf-scan-multi_ports", normalized_reason: "PF_SCAN_MULTI_PORTS", decision_type: "ban", alert_level: "CRIT", http_method: null, request_path: null, http_status: null, user_agent: null },
  { id: 6, event_time: hours(7), ip: "89.248.163.200", scenario: "crowdsecurity/ssh-bf", normalized_reason: "SSH_BRUTEFORCE", decision_type: "ban", alert_level: "CRIT", http_method: null, request_path: null, http_status: null, user_agent: null },
  { id: 7, event_time: hours(10), ip: "178.128.91.55", scenario: "crowdsecurity/http-probing", normalized_reason: "HTTP_PROBING", decision_type: "ban", alert_level: "WARN", http_method: "GET", request_path: "/phpmyadmin/", http_status: 404, user_agent: "DirBuster-1.0-RC1" },
];

// Timeline data for charts (auth failures per hour, last 24h)
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
  // Add some synthetic variation
  const base = Math.max(0, Math.floor(Math.random() * 5) + (h < 6 ? 3 : h < 12 ? 7 : 4));
  return {
    hour: `${d.getHours().toString().padStart(2, "0")}:00`,
    smtp: counts.smtp + base + Math.floor(Math.random() * 4),
    imap: counts.imap + Math.floor(base * 0.4),
  };
});

// Events per source for pie/bar
export const eventsBySource = [
  { source: "Postfix", count: 42, fill: "hsl(0 84% 60%)" },
  { source: "Netfilter", count: 28, fill: "hsl(38 92% 50%)" },
  { source: "Dovecot", count: 15, fill: "hsl(217 91% 60%)" },
  { source: "CrowdSec", count: 7, fill: "hsl(142 71% 45%)" },
];

// Top aggressive external IPs (30 Days)
export interface AggressiveIP30Days {
  ip: string;
  treffer: number;
  level: string;
  quelle: string;
  grund: string;
  konto: string | null;
  last_seen: string;
  letzte_meldung: string;
  organisation: string;
  land: string;
  ptr: string;
}

const days = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return dt.toISOString();
};

export const mockAggressiveIPs30Days: AggressiveIP30Days[] = [
  { ip: "18.218.118.203", treffer: 117, level: "WARN", quelle: "postfix", grund: "Warning", konto: null, last_seen: days(0), letzte_meldung: "CRIT: Banning 18.218.118.203/32 for 960 minutes", organisation: "Amazon AWS", land: "US", ptr: "-" },
  { ip: "134.209.244.59", treffer: 10, level: "WARN", quelle: "postfix", grund: "improper_command_pipelining", konto: null, last_seen: days(1), letzte_meldung: "postfix/submission/smtpd[50857]: improper command pipelining after CONNECT", organisation: "DigitalOcean", land: "NL", ptr: "-" },
  { ip: "3.131.220.121", treffer: 12, level: "WARN", quelle: "postfix", grund: "non_smtp_command", konto: null, last_seen: days(1), letzte_meldung: "INFO: Unbanning 3.131.220.121/32", organisation: "Amazon AWS", land: "US", ptr: "-" },
  { ip: "18.116.101.220", treffer: 62, level: "WARN", quelle: "postfix", grund: "unbanning", konto: null, last_seen: days(2), letzte_meldung: "INFO: Unbanning 18.116.101.220/32", organisation: "Amazon AWS", land: "US", ptr: "-" },
  { ip: "34.193.119.44", treffer: 15, level: "WARN", quelle: "postfix", grund: "unbanning", konto: null, last_seen: days(2), letzte_meldung: "WARN: 34.193.119.44 matched rule id 4", organisation: "Amazon AWS", land: "US", ptr: "-" },
  { ip: "45.141.84.91", treffer: 89, level: "CRIT", quelle: "netfilter", grund: "banning", konto: "info@example.com", last_seen: days(3), letzte_meldung: "netfilter: banning 45.141.84.91 for brute-force SMTP", organisation: "unbekannt", land: "RU", ptr: "-" },
  { ip: "193.56.29.44", treffer: 45, level: "CRIT", quelle: "netfilter", grund: "banning", konto: null, last_seen: days(5), letzte_meldung: "netfilter: banning 193.56.29.44 - repeated auth failures", organisation: "unbekannt", land: "UA", ptr: "-" },
  { ip: "89.248.163.200", treffer: 33, level: "CRIT", quelle: "crowdsec", grund: "ssh_bruteforce", konto: null, last_seen: days(7), letzte_meldung: "crowdsec: ban 89.248.163.200 SSH bruteforce", organisation: "Censys Inc.", land: "US", ptr: "scanner.censys.io" },
  { ip: "162.142.125.40", treffer: 21, level: "WARN", quelle: "crowdsec", grund: "http_probing", konto: null, last_seen: days(10), letzte_meldung: "crowdsec: ban 162.142.125.40 HTTP sensitive files", organisation: "Censys Inc.", land: "US", ptr: "scanner.censys.io" },
  { ip: "5.188.206.14", treffer: 18, level: "WARN", quelle: "postfix", grund: "lost_connection_after_auth", konto: null, last_seen: days(14), letzte_meldung: "postfix: lost connection after AUTH from 5.188.206.14", organisation: "EstNOC OY", land: "EE", ptr: "-" },
];

// Internal auth/password problems (30 days)
export interface InternalAuthProblem {
  ip: string;
  failed_logins: number;
  username: string;
  login_type: string;
  last_seen: string;
  organisation: string;
  land: string;
  ptr: string;
}

export const mockInternalAuthProblems: InternalAuthProblem[] = [
  { ip: "172.22.1.13", failed_logins: 14962, username: "watchdog@invalid", login_type: "smtp", last_seen: days(0), organisation: "intern", land: "DE", ptr: "mailcow.local" },
  { ip: "192.168.3.108", failed_logins: 1056, username: "info@servuswir.de", login_type: "smtp", last_seen: days(2), organisation: "intern", land: "DE", ptr: "nas.local" },
  { ip: "192.168.1.50", failed_logins: 312, username: "admin@example.com", login_type: "imap", last_seen: days(1), organisation: "intern", land: "DE", ptr: "desktop-pc.local" },
  { ip: "10.0.0.25", failed_logins: 89, username: "backup@example.com", login_type: "smtp", last_seen: days(5), organisation: "intern", land: "DE", ptr: "backup-srv.local" },
  { ip: "172.22.1.100", failed_logins: 45, username: "scanner@internal", login_type: "smtp", last_seen: days(8), organisation: "intern", land: "DE", ptr: "scanner.local" },
];
