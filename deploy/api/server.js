/**
 * Dashboard API – connects to MariaDB (logdb) and serves JSON
 * for the React dashboard.
 */
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { spawn } from "child_process";

const app = express();
app.use(cors());
app.use(express.json());

// ── DB pool ──────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.MARIADB_HOST || "host.docker.internal",
  port: parseInt(process.env.MARIADB_PORT || "3306"),
  user: process.env.MARIADB_USER || "loguser",
  password: process.env.MARIADB_PASSWORD || "logpass123",
  database: process.env.MARIADB_DATABASE || "logdb",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ── Stats Cards ──────────────────────────────────────────────
app.get("/api/stats", async (_req, res) => {
  try {
    const [[secRow]] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(event_time > NOW() - INTERVAL 24 HOUR) as h24,
        SUM(event_time > NOW() - INTERVAL 7 DAY) as d7,
        SUM(event_time > NOW() - INTERVAL 30 DAY) as d30
      FROM security_events
    `);
    const [[banRow]] = await pool.query(`
      SELECT
        SUM(current_status = 'banned') as total,
        SUM(current_status = 'banned' AND last_seen > NOW() - INTERVAL 24 HOUR) as h24,
        SUM(current_status = 'banned' AND last_seen > NOW() - INTERVAL 7 DAY) as d7,
        SUM(current_status = 'banned' AND last_seen > NOW() - INTERVAL 30 DAY) as d30
      FROM ip_summary
    `);
    const [[authRow]] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(event_time > NOW() - INTERVAL 24 HOUR) as h24,
        SUM(event_time > NOW() - INTERVAL 7 DAY) as d7,
        SUM(event_time > NOW() - INTERVAL 30 DAY) as d30
      FROM auth_events WHERE auth_status = 'failed'
    `);
    const [[csRow]] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(event_time > NOW() - INTERVAL 24 HOUR) as h24,
        SUM(event_time > NOW() - INTERVAL 7 DAY) as d7,
        SUM(event_time > NOW() - INTERVAL 30 DAY) as d30
      FROM security_events
      WHERE source_system = 'opnsense' AND scenario_name IS NOT NULL
    `);
    res.json({
      security_events: { value: Number(secRow.d30 || 0), h24: Number(secRow.h24 || 0), d7: Number(secRow.d7 || 0), d30: Number(secRow.d30 || 0) },
      banned_ips: { value: Number(banRow.total || 0), h24: Number(banRow.h24 || 0), d7: Number(banRow.d7 || 0), d30: Number(banRow.d30 || 0) },
      auth_failures: { value: Number(authRow.d30 || 0), h24: Number(authRow.h24 || 0), d7: Number(authRow.d7 || 0), d30: Number(authRow.d30 || 0) },
      crowdsec_alerts: { value: Number(csRow.d30 || 0), h24: Number(csRow.h24 || 0), d7: Number(csRow.d7 || 0), d30: Number(csRow.d30 || 0) },
    });
  } catch (err) {
    console.error("GET /api/stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Security Events (Event Feed) ────────────────────────────
app.get("/api/security-events", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50"), 200);
    const [rows] = await pool.query(
      `SELECT * FROM security_events ORDER BY event_time DESC LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/security-events error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Auth Events ─────────────────────────────────────────────
app.get("/api/auth-events", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50"), 200);
    const [rows] = await pool.query(
      `SELECT * FROM auth_events ORDER BY event_time DESC LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/auth-events error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── CrowdSec Alerts ─────────────────────────────────────────
app.get("/api/crowdsec-alerts", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50"), 200);
    const [rows] = await pool.query(
      `SELECT id, event_time, ip, scenario_name, normalized_reason,
              decision_source, alert_level, http_method, request_path,
              http_status, user_agent
       FROM security_events
       WHERE source_system = 'opnsense' AND scenario_name IS NOT NULL
       ORDER BY event_time DESC LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/crowdsec-alerts error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Top Attackers (24h / 7d / 30d) ──────────────────────────
app.get("/api/top-attackers", async (req, res) => {
  try {
    const window = req.query.window || "24h";
    const limit = Math.min(parseInt(req.query.limit || "25"), 100);
    let interval;
    switch (window) {
      case "7d":  interval = "7 DAY"; break;
      case "30d": interval = "30 DAY"; break;
      default:    interval = "24 HOUR";
    }
    const [rows] = await pool.query(`
      SELECT
        s.ip,
        s.total_events,
        s.total_bans as bans,
        s.total_auth_failures as auth_failures,
        COALESCE(cs.crowdsec_count, 0) as crowdsec,
        s.last_seen,
        s.last_alert_level,
        s.last_event_type,
        e.country,
        e.org_name,
        e.asn,
        COALESCE(r.score, 0) as risk_score,
        COALESCE(r.risk_level, 'LOW') as risk_level
      FROM ip_summary s
      LEFT JOIN ip_enrichment e ON s.ip = e.ip
      LEFT JOIN ip_risk_score r ON s.ip = r.ip
      LEFT JOIN (
        SELECT ip, COUNT(*) as crowdsec_count
        FROM security_events
        WHERE source_system = 'opnsense' AND scenario_name IS NOT NULL
          AND event_time > NOW() - INTERVAL ${interval}
        GROUP BY ip
      ) cs ON s.ip = cs.ip
      WHERE s.last_seen > NOW() - INTERVAL ${interval}
        AND COALESCE(e.ip_scope, 'external') = 'external'
      ORDER BY COALESCE(r.score, 0) DESC, s.total_events DESC
      LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/top-attackers error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── IP Stats 7 Days (View) ──────────────────────────────────
app.get("/api/ip-stats-7d", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM vw_ip_stats_7d ORDER BY treffer DESC LIMIT 100`
    );
    // Map German column names to what the frontend expects
    res.json(rows.map(r => ({
      ip: r.ip,
      total_events: Number(r.treffer),
      first_seen: r.erstes_auftreten,
      last_seen: r.letztes_auftreten,
      last_target_email: r.haeufigstes_zielkonto || null,
      last_event_type: r.haeufigster_grund || "unknown",
    })));
  } catch (err) {
    console.error("GET /api/ip-stats-7d error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Aggressive IPs 30 Days (View + enrichment + risk) ───────
app.get("/api/aggressive-ips-30d", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        v.ip,
        v.treffer as total_events,
        v.level as last_alert_level,
        v.quelle as last_source_component,
        v.grund as last_event_type,
        v.konto as last_username,
        v.last_seen,
        v.letzte_meldung as last_message,
        e.country,
        e.asn,
        e.org_name,
        e.ptr,
        COALESCE(r.score, 0) as risk_score,
        COALESCE(r.risk_level, 'LOW') as risk_level,
        s.total_bans,
        s.total_auth_failures,
        s.current_status,
        s.last_target_email,
        s.last_destination_port,
        s.last_destination_service
      FROM vw_top_aggressive_external_ips_30d_v3 v
      LEFT JOIN ip_enrichment e ON v.ip = e.ip
      LEFT JOIN ip_risk_score r ON v.ip = r.ip
      LEFT JOIN ip_summary s ON v.ip = s.ip
      ORDER BY COALESCE(r.score, 0) DESC
      LIMIT 100
    `);
    res.json(rows.map(r => ({
      ...r,
      total_events: Number(r.total_events),
      total_bans: Number(r.total_bans || 0),
      total_auth_failures: Number(r.total_auth_failures || 0),
      risk_score: Number(r.risk_score),
    })));
  } catch (err) {
    console.error("GET /api/aggressive-ips-30d error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Internal Auth Problems (View) ───────────────────────────
app.get("/api/internal-auth-problems", async (_req, res) => {
  try {
    // Try v2 view first, fallback to v1
    let rows;
    try {
      [rows] = await pool.query(
        `SELECT * FROM vw_internal_auth_problems_30d_v2 ORDER BY failed_logins DESC LIMIT 100`
      );
    } catch {
      [rows] = await pool.query(
        `SELECT * FROM vw_internal_auth_problems_30d ORDER BY failed_logins DESC LIMIT 100`
      );
    }
    // Enrich with ip_enrichment data
    const ips = rows.map(r => r.ip);
    let enrichMap = new Map();
    if (ips.length > 0) {
      const [enrichRows] = await pool.query(
        `SELECT * FROM ip_enrichment WHERE ip IN (?)`, [ips]
      );
      enrichRows.forEach(e => enrichMap.set(e.ip, e));
    }
    res.json(rows.map(r => {
      const e = enrichMap.get(r.ip) || {};
      return {
        ip: r.ip,
        failed_logins: Number(r.failed_logins),
        username: r.username || r.konto || "-",
        login_type: r.login_type || r.typ || "unknown",
        last_seen: r.last_seen || r.letztes_auftreten,
        ip_scope: r.ip_scope || e.ip_scope || "unknown",
        hostname: r.hostname || null,
        destination_port: r.destination_port || r.ziel_port || "-",
        organisation: e.org_name || "intern",
        land: e.country || "DE",
        ptr: e.ptr || r.hostname || "-",
        ziel_port: String(r.destination_port || r.ziel_port || "-"),
      };
    }));
  } catch (err) {
    console.error("GET /api/internal-auth-problems error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Attack Timeline (aggregated buckets) ────────────────────
app.get("/api/attack-timeline", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours || "168"); // default 7 days
    const bucketHours = parseInt(req.query.bucket || "4");
    const [rows] = await pool.query(`
      SELECT
        FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(event_time) / (? * 3600)) * (? * 3600)) as bucket_time,
        SUM(CASE WHEN normalized_reason LIKE '%BRUTE%' OR warning_type = 'brute_force' THEN 1 ELSE 0 END) as brute_force,
        SUM(CASE WHEN normalized_reason LIKE '%SCAN%' OR normalized_reason LIKE '%PORT%' THEN 1 ELSE 0 END) as port_scan,
        SUM(CASE WHEN normalized_reason LIKE '%AUTH_FAILED%' THEN 1 ELSE 0 END) as auth_failure,
        SUM(CASE WHEN ban_status = 'banning' THEN 1 ELSE 0 END) as ban,
        SUM(CASE WHEN normalized_reason LIKE '%PROBING%' OR normalized_reason LIKE '%SENSITIVE%' OR normalized_reason LIKE '%CRAWL%' THEN 1 ELSE 0 END) as crawl_probe,
        COUNT(*) as total
      FROM security_events
      WHERE event_time > NOW() - INTERVAL ? HOUR
      GROUP BY bucket_time
      ORDER BY bucket_time ASC
    `, [bucketHours, bucketHours, hours]);
    res.json(rows.map(r => ({
      time: r.bucket_time,
      brute_force: Number(r.brute_force || 0),
      port_scan: Number(r.port_scan || 0),
      auth_failure: Number(r.auth_failure || 0),
      ban: Number(r.ban || 0),
      crawl_probe: Number(r.crawl_probe || 0),
      total: Number(r.total || 0),
    })));
  } catch (err) {
    console.error("GET /api/attack-timeline error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Auth Failure Timeline (per hour, last 24h) ──────────────
app.get("/api/auth-timeline", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(event_time, '%H:00') as hour,
        SUM(CASE WHEN login_type IN ('smtp') THEN 1 ELSE 0 END) as smtp,
        SUM(CASE WHEN login_type IN ('imap','pop3') THEN 1 ELSE 0 END) as imap
      FROM auth_events
      WHERE auth_status = 'failed'
        AND event_time > NOW() - INTERVAL 24 HOUR
      GROUP BY DATE_FORMAT(event_time, '%H:00')
      ORDER BY hour ASC
    `);
    res.json(rows.map(r => ({
      hour: r.hour,
      smtp: Number(r.smtp || 0),
      imap: Number(r.imap || 0),
    })));
  } catch (err) {
    console.error("GET /api/auth-timeline error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Auth events for one hour bucket (last 24h) ──────────────
// Query: ?hour=HH:00 [&type=smtp|imap]
app.get("/api/auth-events/by-hour", async (req, res) => {
  try {
    const hour = String(req.query.hour || "");
    if (!/^\d{2}:00$/.test(hour)) {
      return res.status(400).json({ error: "hour must be HH:00" });
    }
    const type = String(req.query.type || "all");
    let typeFilter = "";
    if (type === "smtp") typeFilter = "AND login_type = 'smtp'";
    else if (type === "imap") typeFilter = "AND login_type IN ('imap','pop3')";

    const [events] = await pool.query(
      `SELECT * FROM auth_events
       WHERE auth_status = 'failed'
         AND event_time > NOW() - INTERVAL 24 HOUR
         AND DATE_FORMAT(event_time, '%H:00') = ?
         ${typeFilter}
       ORDER BY event_time DESC
       LIMIT 500`,
      [hour]
    );
    const byIp = {};
    for (const e of events) {
      const ip = e.ip || "unknown";
      if (!byIp[ip]) byIp[ip] = { ip, count: 0, last_seen: e.event_time, login_types: new Set(), users: new Set() };
      byIp[ip].count++;
      if (e.login_type) byIp[ip].login_types.add(e.login_type);
      if (e.username) byIp[ip].users.add(e.username);
    }
    const ips = Object.values(byIp).map(r => ({
      ip: r.ip,
      count: r.count,
      last_seen: r.last_seen,
      login_types: [...r.login_types],
      users: [...r.users].slice(0, 5),
    })).sort((a, b) => b.count - a.count);
    res.json({ hour, type, events, by_ip: ips });
  } catch (err) {
    console.error("GET /api/auth-events/by-hour error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Security events by source (Postfix/Netfilter/Dovecot/CrowdSec) ──
// Query: ?source=postfix|netfilter|dovecot|crowdsec [&window=24h|7d|30d]
app.get("/api/security-events/by-source", async (req, res) => {
  try {
    const source = String(req.query.source || "").toLowerCase();
    const window = String(req.query.window || "24h");
    const allowed = ["postfix", "netfilter", "dovecot", "crowdsec"];
    if (!allowed.includes(source)) {
      return res.status(400).json({ error: "invalid source" });
    }
    const intervalSql =
      window === "7d" ? "INTERVAL 7 DAY"
      : window === "30d" ? "INTERVAL 30 DAY"
      : "INTERVAL 24 HOUR";

    const where = source === "crowdsec"
      ? `(source_component = 'crowdsec' OR source_system = 'opnsense')`
      : `source_component = '${source}'`;

    const [events] = await pool.query(
      `SELECT * FROM security_events
       WHERE ${where}
         AND event_time > NOW() - ${intervalSql}
       ORDER BY event_time DESC
       LIMIT 500`
    );
    const byIp = {};
    for (const e of events) {
      const ip = e.ip || "unknown";
      if (!byIp[ip]) byIp[ip] = { ip, count: 0, last_seen: e.event_time, types: new Set() };
      byIp[ip].count++;
      if (e.event_type) byIp[ip].types.add(e.event_type);
    }
    const ips = Object.values(byIp).map(r => ({
      ip: r.ip,
      count: r.count,
      last_seen: r.last_seen,
      types: [...r.types].slice(0, 5),
    })).sort((a, b) => b.count - a.count);
    res.json({ source, window, events, by_ip: ips });
  } catch (err) {
    console.error("GET /api/security-events/by-source error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Events by Source ────────────────────────────────────────
app.get("/api/events-by-source", async (_req, res) => {
  try {
    const sources = ["postfix", "netfilter", "dovecot", "crowdsec"];
    const results = [];
    for (const src of sources) {
      const isComponent = src !== "crowdsec";
      const where = isComponent
        ? `source_component = '${src}'`
        : `(source_component = 'crowdsec' OR source_system = 'opnsense')`;
      const [[row]] = await pool.query(`
        SELECT
          SUM(event_time > NOW() - INTERVAL 24 HOUR) as h24,
          SUM(event_time > NOW() - INTERVAL 7 DAY) as d7,
          SUM(event_time > NOW() - INTERVAL 30 DAY) as d30
        FROM security_events WHERE ${where}
      `);
      const fills = {
        postfix:   { fill: "hsl(0 84% 60%)",   fillMid: "hsl(0 84% 45%)",   fillLight: "hsl(0 84% 32%)" },
        netfilter: { fill: "hsl(38 92% 50%)",   fillMid: "hsl(38 92% 38%)",  fillLight: "hsl(38 92% 26%)" },
        dovecot:   { fill: "hsl(217 91% 60%)",  fillMid: "hsl(217 91% 45%)", fillLight: "hsl(217 91% 32%)" },
        crowdsec:  { fill: "hsl(142 71% 45%)",  fillMid: "hsl(142 71% 33%)", fillLight: "hsl(142 71% 22%)" },
      };
      results.push({
        source: src.charAt(0).toUpperCase() + src.slice(1),
        h24: Number(row.h24 || 0),
        d7: Number(row.d7 || 0),
        d30: Number(row.d30 || 0),
        ...fills[src],
      });
    }
    res.json(results);
  } catch (err) {
    console.error("GET /api/events-by-source error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── IP Detail ───────────────────────────────────────────────
app.get("/api/ip/:ip", async (req, res) => {
  try {
    const ip = req.params.ip;
    const [[summary]] = await pool.query(`SELECT * FROM ip_summary WHERE ip = ?`, [ip]);
    const [[enrichment]] = await pool.query(`SELECT * FROM ip_enrichment WHERE ip = ?`, [ip]);
    const [[risk]] = await pool.query(`SELECT * FROM ip_risk_score WHERE ip = ?`, [ip]);
    res.json({
      summary: summary || null,
      enrichment: enrichment || null,
      risk: risk || null,
    });
  } catch (err) {
    console.error(`GET /api/ip/${req.params.ip} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ── IP Events (for timeline) ────────────────────────────────
app.get("/api/ip/:ip/events", async (req, res) => {
  try {
    const ip = req.params.ip;
    const limit = Math.min(parseInt(req.query.limit || "200"), 500);
    const [secEvents] = await pool.query(
      `SELECT *, 'security_events' as _table FROM security_events WHERE ip = ? ORDER BY event_time DESC LIMIT ?`,
      [ip, limit]
    );
    const [authEvents] = await pool.query(
      `SELECT *, 'auth_events' as _table FROM auth_events WHERE ip = ? ORDER BY event_time DESC LIMIT ?`,
      [ip, limit]
    );
    res.json({ security_events: secEvents, auth_events: authEvents });
  } catch (err) {
    console.error(`GET /api/ip/${req.params.ip}/events error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ── IP Daily Summary (for charts) ───────────────────────────
app.get("/api/ip/:ip/daily", async (req, res) => {
  try {
    const ip = req.params.ip;
    const [rows] = await pool.query(
      `SELECT * FROM ip_daily_summary WHERE ip = ? ORDER BY summary_date DESC LIMIT 30`,
      [ip]
    );
    res.json(rows);
  } catch (err) {
    console.error(`GET /api/ip/${req.params.ip}/daily error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ── GeoIP Aggregation (for map) ─────────────────────────────
app.get("/api/geo-attacks", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        e.country,
        COUNT(*) as count,
        SUM(CASE WHEN se.ban_status = 'banning' THEN 1 ELSE 0 END) as bans,
        MAX(se.event_time) as last_seen
      FROM ip_enrichment e
      JOIN security_events se ON e.ip = se.ip
      WHERE e.country IS NOT NULL
        AND se.event_time > NOW() - INTERVAL 30 DAY
      GROUP BY e.country
      ORDER BY count DESC
      LIMIT 50
    `);
    res.json(rows.map(r => ({
      country: r.country,
      count: Number(r.count),
      bans: Number(r.bans),
      last_seen: r.last_seen,
    })));
  } catch (err) {
    console.error("GET /api/geo-attacks error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Tools / Manual scripts ──────────────────────────────────
// Whitelist of scripts that can be triggered from the dashboard.
// Each entry is run from COLLECTOR_ROOT (default /opt/logserver/collector)
// using the configured Python interpreter.
const COLLECTOR_ROOT = process.env.COLLECTOR_ROOT || "/opt/logserver/collector";
const COLLECTOR_PY = process.env.COLLECTOR_PY || `${COLLECTOR_ROOT}/venv/bin/python3`;

const TOOL_SCRIPTS = {
  ip_enricher: {
    label: "IP Enricher (GeoIP / ASN nachladen)",
    args: ["-m", "src.metrics.ip_enricher"],
    description:
      "Lädt fehlende GeoIP-, ASN- und Org-Infos für IPs in ip_enrichment nach. Behebt '??' in der Spalte Land der Top-Angreifer.",
  },
  risk_engine: {
    label: "Risk-Score neu berechnen",
    args: ["-m", "src.metrics.ip_risk_engine"],
    description:
      "Berechnet den Risiko-Score für alle bekannten IPs neu (ip_risk_engine).",
  },
  daily_summary: {
    label: "Daily-Summary neu aufbauen",
    args: ["-m", "src.metrics.daily_summary_builder"],
    description:
      "Aktualisiert die täglichen Aggregat-Tabellen (ip_summary, daily_*).",
  },
  crowdsec_sync: {
    label: "CrowdSec Decisions synchronisieren",
    args: ["-m", "src.crowdsec.crowdsec_decision_sync"],
    description:
      "Holt die aktuelle CrowdSec-Bann-Liste (cscli decisions) und synchronisiert sie in die DB.",
  },
  crowdsec_fetch: {
    label: "CrowdSec Alerts abholen",
    args: ["-m", "src.fetchers.crowdsec_fetcher"],
    description:
      "Pollt CrowdSec-Alerts von den konfigurierten Quellen und schreibt sie in die DB.",
  },
  ssh_fetch: {
    label: "SSH Auth-Logs abholen",
    args: ["-m", "src.fetchers.ssh_fetcher"],
    description:
      "Holt SSH-Authentifizierungs-Logs von den überwachten Hosts.",
  },
  check_db: {
    label: "DB Health-Check",
    args: ["check_db.py"],
    description:
      "Read-only: Verbindungstest, Row-Counts und Status der wichtigsten Tabellen.",
  },
};

app.get("/api/tools", (_req, res) => {
  res.json(
    Object.entries(TOOL_SCRIPTS).map(([id, s]) => ({
      id,
      label: s.label,
      description: s.description,
    }))
  );
});

app.post("/api/tools/run", (req, res) => {
  const id = String(req.body?.id || "");
  const tool = TOOL_SCRIPTS[id];
  if (!tool) return res.status(400).json({ error: "Unbekanntes Tool" });

  const child = spawn(COLLECTOR_PY, tool.args, {
    cwd: COLLECTOR_ROOT,
    env: { ...process.env, PYTHONPATH: COLLECTOR_ROOT },
  });

  let stdout = "";
  let stderr = "";
  let finished = false;

  const timeout = setTimeout(() => {
    if (!finished) {
      try { child.kill("SIGKILL"); } catch { /* */ }
    }
  }, 120_000);

  child.stdout.on("data", (d) => { stdout += d.toString(); });
  child.stderr.on("data", (d) => { stderr += d.toString(); });
  child.on("error", (err) => {
    finished = true;
    clearTimeout(timeout);
    res.status(500).json({ error: err.message, stdout, stderr });
  });
  child.on("close", (code) => {
    finished = true;
    clearTimeout(timeout);
    res.json({
      id,
      exit_code: code,
      ok: code === 0,
      stdout: stdout.slice(-8000),
      stderr: stderr.slice(-8000),
    });
  });
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard API listening on :${PORT}`);
});
