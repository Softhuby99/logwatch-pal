/**
 * Dashboard API – connects to MariaDB (logdb) and serves JSON
 * for the React dashboard.
 */
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { spawn, spawnSync } from "child_process";
import path from "path";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

// ── SSH key bootstrap ────────────────────────────────────────
// Auto-generate an ed25519 keypair on first start so the dashboard can
// connect to remote hosts (OPNsense, Mailcow, PMG, …) for status checks.
// Key lives in the api_ssh docker volume mounted at /home/node/.ssh.
const SSH_DIR = process.env.SSH_KEY_DIR || "/home/node/.ssh";
const SSH_KEY_NAME = process.env.SSH_KEY_NAME || "id_ed25519_dashboard";
const SSH_KEY_PATH = path.join(SSH_DIR, SSH_KEY_NAME);
const SSH_PUB_PATH = `${SSH_KEY_PATH}.pub`;

function ensureSshKey() {
  try {
    if (!fs.existsSync(SSH_DIR)) fs.mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(SSH_DIR, 0o700); } catch {}
    if (!fs.existsSync(SSH_KEY_PATH)) {
      const r = spawnSync("ssh-keygen", [
        "-t", "ed25519",
        "-N", "",
        "-C", "dashboard@api",
        "-f", SSH_KEY_PATH,
      ], { stdio: "inherit" });
      if (r.status !== 0) {
        console.error("[ssh] ssh-keygen failed", r.error || `exit ${r.status}`);
        return;
      }
      console.log(`[ssh] generated key ${SSH_KEY_PATH}`);
    }
    try { fs.chmodSync(SSH_KEY_PATH, 0o600); } catch {}
  } catch (e) {
    console.error("[ssh] key bootstrap failed:", e.message);
  }
}
ensureSshKey();

// Expose public key so the user can copy it into authorized_keys on targets.
app.get("/api/ssh/pubkey", (_req, res) => {
  try {
    if (!fs.existsSync(SSH_PUB_PATH)) return res.status(404).json({ error: "pubkey not yet generated" });
    res.type("text/plain").send(fs.readFileSync(SSH_PUB_PATH, "utf8"));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Version marker — bump on each meaningful change so we can confirm
// the running container actually has the new code.
const API_VERSION = "0.6.5-auth-success-chart";
app.get("/api/version", (_req, res) => res.json({ version: API_VERSION }));
console.log(`[startup] API version ${API_VERSION}`);

const AUTH_FAILURE_WHERE = `(
  LOWER(COALESCE(auth_status, '')) = 'failed'
  OR UPPER(COALESCE(normalized_reason, '')) LIKE '%AUTH_FAILED%'
  OR LOWER(COALESCE(raw_reason, '')) LIKE '%auth%fail%'
  OR LOWER(COALESCE(message, '')) LIKE '%auth%fail%'
  OR LOWER(COALESCE(message, '')) LIKE '%login%fail%'
)`;

const SMTP_LOGIN_WHERE = "LOWER(COALESCE(login_type, '')) IN ('smtp', 'submission', 'smtps')";
const IMAP_LOGIN_WHERE = "LOWER(COALESCE(login_type, '')) IN ('imap', 'imaps', 'pop3', 'pop3s')";

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
  dateStrings: true,
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
      FROM auth_events WHERE ${AUTH_FAILURE_WHERE}
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
  const mapRow = (r) => ({
    ...r,
    total_events: Number(r.total_events || 0),
    total_bans: Number(r.total_bans || 0),
    total_auth_failures: Number(r.total_auth_failures || 0),
    risk_score: Number(r.risk_score || 0),
  });
  try {
    let rows = [];
    // 1) Primärquelle: vorhandene View
    try {
      const [viewRows] = await pool.query(`
        SELECT
          v.ip,
          v.treffer as total_events,
          v.level as last_alert_level,
          v.quelle as last_source_component,
          v.grund as last_event_type,
          v.konto as last_username,
          v.last_seen,
          v.letzte_meldung as last_message,
          e.country, e.asn, e.org_name, e.ptr,
          COALESCE(r.score, 0) as risk_score,
          COALESCE(r.risk_level, 'LOW') as risk_level,
          s.total_bans, s.total_auth_failures, s.current_status,
          s.last_target_email, s.last_destination_port, s.last_destination_service
        FROM vw_top_aggressive_external_ips_30d_v3 v
        LEFT JOIN ip_enrichment e ON v.ip = e.ip
        LEFT JOIN ip_risk_score r ON v.ip = r.ip
        LEFT JOIN ip_summary s ON v.ip = s.ip
        ORDER BY COALESCE(r.score, 0) DESC
        LIMIT 100
      `);
      rows = viewRows;
    } catch (viewErr) {
      console.warn("[aggressive-ips-30d] view query failed, falling back:", viewErr.message);
    }

    // 2) Fallback: direkter Aggregat-Query, wenn View leer oder fehlt
    if (!rows || rows.length === 0) {
      const [fbRows] = await pool.query(`
        SELECT
          s.ip,
          s.total_events,
          s.last_alert_level,
          s.last_source_component,
          s.last_event_type,
          s.last_username,
          s.last_seen,
          NULL as last_message,
          e.country, e.asn, e.org_name, e.ptr,
          COALESCE(r.score, 0) as risk_score,
          COALESCE(r.risk_level, 'LOW') as risk_level,
          s.total_bans, s.total_auth_failures, s.current_status,
          s.last_target_email, s.last_destination_port, s.last_destination_service
        FROM ip_summary s
        LEFT JOIN ip_enrichment e ON s.ip = e.ip
        LEFT JOIN ip_risk_score r ON s.ip = r.ip
        WHERE s.last_seen > NOW() - INTERVAL 30 DAY
          AND COALESCE(e.ip_scope, 'external') = 'external'
        ORDER BY COALESCE(r.score, 0) DESC, s.total_events DESC
        LIMIT 100
      `);
      rows = fbRows;
    }
    res.json(rows.map(mapRow));
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

// ── Auth Failure Timeline (per hour, last 24h, zero-filled) ──
app.get("/api/auth-timeline", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(event_time, '%Y-%m-%d %H:00:00') as bucket_start,
        SUM(CASE WHEN ${SMTP_LOGIN_WHERE} THEN 1 ELSE 0 END) as smtp,
        SUM(CASE WHEN ${IMAP_LOGIN_WHERE} THEN 1 ELSE 0 END) as imap,
        SUM(CASE WHEN NOT (${SMTP_LOGIN_WHERE}) AND NOT (${IMAP_LOGIN_WHERE}) THEN 1 ELSE 0 END) as other
      FROM auth_events
      WHERE ${AUTH_FAILURE_WHERE}
        AND event_time >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'), INTERVAL 23 HOUR)
        AND event_time < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'), INTERVAL 1 HOUR)
      GROUP BY bucket_start
      ORDER BY bucket_start ASC
    `);
    const byBucket = new Map();
    for (const r of rows) {
      byBucket.set(String(r.bucket_start), {
        smtp: Number(r.smtp || 0),
        imap: Number(r.imap || 0),
        other: Number(r.other || 0),
      });
    }
    // Zero-fill 24 stündliche Buckets
    const out = [];
    const now = new Date();
    const baseHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    for (let i = 23; i >= 0; i--) {
      const d = new Date(baseHour.getTime() - i * 3600_000);
      const pad = (n) => String(n).padStart(2, "0");
      const bucket_start = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`;
      const hour = `${pad(d.getHours())}:00`;
      const v = byBucket.get(bucket_start) || { smtp: 0, imap: 0, other: 0 };
      out.push({ hour, bucket_start, ...v });
    }
    res.json(out);
  } catch (err) {
    console.error("GET /api/auth-timeline error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DEBUG: auth_events Inhalte verstehen ────────────────────
app.get("/api/auth-debug", async (_req, res) => {
  try {
    const out = {};
    const [cols] = await pool.query(`SHOW COLUMNS FROM auth_events`);
    out.columns = cols.map(c => c.Field);
    const [[total]] = await pool.query(`SELECT COUNT(*) as c FROM auth_events`);
    out.total_rows = Number(total.c);
    const [[h24]] = await pool.query(
      `SELECT COUNT(*) as c FROM auth_events WHERE event_time > NOW() - INTERVAL 24 HOUR`
    );
    out.rows_last_24h = Number(h24.c);
    const [[matched]] = await pool.query(
      `SELECT COUNT(*) as c FROM auth_events
       WHERE event_time > NOW() - INTERVAL 24 HOUR AND ${AUTH_FAILURE_WHERE}`
    );
    out.matched_failure_filter_24h = Number(matched.c);
    const tryDistinct = async (col) => {
      try {
        const [rows] = await pool.query(
          `SELECT \`${col}\` as v, COUNT(*) as c FROM auth_events
           WHERE event_time > NOW() - INTERVAL 24 HOUR
           GROUP BY \`${col}\` ORDER BY c DESC LIMIT 10`
        );
        return rows.map(r => ({ value: r.v, count: Number(r.c) }));
      } catch (e) { return { error: e.message }; }
    };
    out.distinct_auth_status = await tryDistinct("auth_status");
    out.distinct_login_type = await tryDistinct("login_type");
    out.distinct_normalized_reason = await tryDistinct("normalized_reason");
    const [sample] = await pool.query(
      `SELECT * FROM auth_events ORDER BY event_time DESC LIMIT 3`
    );
    out.sample = sample;
    res.json(out);
  } catch (err) {
    console.error("GET /api/auth-debug error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Auth events for one hour bucket (last 24h) ──────────────
// Query: ?hour=HH:00 [&type=smtp|imap]
app.get("/api/auth-events/by-hour", async (req, res) => {
  try {
    const bucketStartRaw = String(req.query.bucket_start || "").trim();
    const hour = String(req.query.hour || "");
    const bucketStart = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:00:00$/.test(bucketStartRaw)
      ? bucketStartRaw.replace("T", " ")
      : "";
    if (!bucketStart && !/^\d{2}:00$/.test(hour)) {
      return res.status(400).json({ error: "bucket_start or hour must be provided" });
    }
    const type = String(req.query.type || "all");
    let typeFilter = "";
    if (type === "smtp") typeFilter = `AND ${SMTP_LOGIN_WHERE}`;
    else if (type === "imap") typeFilter = `AND ${IMAP_LOGIN_WHERE}`;
    else if (type === "other") typeFilter = `AND NOT (${SMTP_LOGIN_WHERE}) AND NOT (${IMAP_LOGIN_WHERE})`;

    const params = [];
    let timeFilter = "";
    if (bucketStart) {
      timeFilter = "AND event_time >= ? AND event_time < DATE_ADD(?, INTERVAL 1 HOUR)";
      params.push(bucketStart, bucketStart);
    } else {
      timeFilter = "AND event_time >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'), INTERVAL 23 HOUR) AND event_time < DATE_ADD(DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'), INTERVAL 1 HOUR) AND DATE_FORMAT(event_time, '%H:00') = ?";
      params.push(hour);
    }

    const [events] = await pool.query(
      `SELECT * FROM auth_events
       WHERE ${AUTH_FAILURE_WHERE}
         ${timeFilter}
         ${typeFilter}
       ORDER BY event_time DESC
       LIMIT 500`,
      params
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
    res.json({ hour: bucketStart ? bucketStart.slice(11, 16) : hour, bucket_start: bucketStart || null, type, events, by_ip: ips });
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

// ── IP Events (for timeline) – inkl. daily-Fallback ─────────
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
    let daily = [];
    try {
      const [dailyRows] = await pool.query(
        `SELECT * FROM ip_daily_summary WHERE ip = ? ORDER BY summary_date DESC LIMIT 30`,
        [ip]
      );
      daily = dailyRows;
    } catch (e) {
      console.warn(`[ip/events] daily fallback query failed for ${ip}:`, e.message);
    }
    res.json({ security_events: secEvents, auth_events: authEvents, daily });
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

// ── Enrichment Diagnostics ──────────────────────────────────
// Read-only check: für die aktuellen Top-IPs aus ip_summary prüfen, welche
// in ip_enrichment fehlen. Liefert auch das tatsächliche Schema von
// ip_enrichment, um Schema-Drift gegenüber Doku/Collector zu erkennen.
app.get("/api/diagnostics/enrichment", async (req, res) => {
  try {
    const window = String(req.query.window || "24h");
    const limit = Math.min(parseInt(req.query.limit || "25"), 200);
    const interval = window === "7d" ? "7 DAY" : window === "30d" ? "30 DAY" : "24 HOUR";

    const [enrCols] = await pool.query(`SHOW COLUMNS FROM ip_enrichment`);
    const [sumCols] = await pool.query(`SHOW COLUMNS FROM ip_summary`);
    const [[enrCount]] = await pool.query(`SELECT COUNT(*) as n FROM ip_enrichment`);
    const [[enrCountry]] = await pool.query(
      `SELECT COUNT(*) as n FROM ip_enrichment WHERE country IS NOT NULL AND country <> ''`,
    );

    const [topIps] = await pool.query(
      `SELECT ip FROM ip_summary
        WHERE last_seen > NOW() - INTERVAL ${interval}
        ORDER BY total_events DESC
        LIMIT ?`,
      [limit],
    );
    const ips = topIps.map((r) => r.ip);

    let enriched = [];
    let missing = ips;
    if (ips.length > 0) {
      const [enrRows] = await pool.query(
        `SELECT ip, country, asn, org_name, ip_scope, last_lookup
           FROM ip_enrichment WHERE ip IN (?)`,
        [ips],
      );
      const haveMap = new Map(enrRows.map((r) => [r.ip, r]));
      enriched = enrRows;
      missing = ips.filter((ip) => !haveMap.has(ip));
    }

    res.json({
      window,
      ip_enrichment_schema: enrCols.map((c) => c.Field),
      ip_summary_schema: sumCols.map((c) => c.Field),
      ip_enrichment_total_rows: Number(enrCount.n || 0),
      ip_enrichment_with_country: Number(enrCountry.n || 0),
      top_ips_in_window: ips.length,
      enriched_count: enriched.length,
      missing_count: missing.length,
      missing_ips: missing,
      enriched_sample: enriched.slice(0, 10),
      hint:
        missing.length > 0
          ? "Top-IPs fehlen in ip_enrichment. Tools → 'IP Enricher' starten, danach 'Risk-Score' und 'Daily-Summary'."
          : "Alle Top-IPs sind enriched. Falls UI noch '??' zeigt: Browser-Cache leeren (Strg+Shift+R).",
    });
  } catch (err) {
    console.error("GET /api/diagnostics/enrichment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Country Backfill (internal, ohne Python-Collector) ──────
// Lädt fehlende country/asn/org_name für IPs in ip_summary nach,
// indem ip-api.com/batch (kostenlos, kein Key, 45 req/min, 100 IPs/Batch)
// abgefragt wird. Schreibt mit INSERT … ON DUPLICATE KEY UPDATE.
const isPrivateIp = (ip) =>
  /^10\./.test(ip) ||
  /^192\.168\./.test(ip) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
  /^127\./.test(ip) ||
  /^::1$/.test(ip) ||
  /^fe80:/i.test(ip) ||
  /^fc00:/i.test(ip);

async function lookupBatch(ips) {
  // ip-api.com batch endpoint, fields bitmask siehe https://ip-api.com/docs/api:batch
  // wir holen: status, countryCode, as, isp, org, reverse, query
  const url = "http://ip-api.com/batch?fields=status,message,countryCode,as,isp,org,reverse,query";
  const body = JSON.stringify(ips.map((ip) => ({ query: ip })));
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`ip-api HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

app.post("/api/tools/backfill-country", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.body?.limit || "100"), 500);
    const mode = String(req.body?.mode || "all"); // missing | null_country | all

    // 1) Kandidaten-IPs aus ip_summary ermitteln
    let sql;
    if (mode === "missing") {
      sql = `SELECT s.ip FROM ip_summary s
             LEFT JOIN ip_enrichment e ON s.ip = e.ip
             WHERE e.ip IS NULL
             ORDER BY s.last_seen DESC LIMIT ?`;
    } else if (mode === "null_country") {
      sql = `SELECT s.ip FROM ip_summary s
             JOIN ip_enrichment e ON s.ip = e.ip
             WHERE e.country IS NULL OR e.country = ''
             ORDER BY s.last_seen DESC LIMIT ?`;
    } else {
      sql = `SELECT s.ip FROM ip_summary s
             LEFT JOIN ip_enrichment e ON s.ip = e.ip
             WHERE e.ip IS NULL OR e.country IS NULL OR e.country = ''
             ORDER BY s.last_seen DESC LIMIT ?`;
    }
    const [rows] = await pool.query(sql, [limit]);
    const allIps = rows.map((r) => r.ip);
    const skipped = allIps.filter(isPrivateIp);
    const candidates = allIps.filter((ip) => !isPrivateIp(ip));

    if (candidates.length === 0) {
      return res.json({
        ok: true, mode, scanned: allIps.length, skipped_private: skipped.length,
        looked_up: 0, updated: 0, failed: 0, message: "Keine externen IPs zu enrichen.",
      });
    }

    // 2) In Batches à 100 anfragen, mit ~1.5s Pause zwischen Batches (45 req/min Limit)
    let updated = 0, failed = 0;
    const failures = [];
    for (let i = 0; i < candidates.length; i += 100) {
      const batch = candidates.slice(i, i + 100);
      let results;
      try {
        results = await lookupBatch(batch);
      } catch (e) {
        failed += batch.length;
        failures.push({ batch: i / 100, error: e.message });
        continue;
      }
      for (const r of results) {
        if (r.status !== "success") {
          failed += 1;
          continue;
        }
        const ip = r.query;
        const country = (r.countryCode || "").slice(0, 2) || null;
        const asn = r.as || null;
        const org = r.org || r.isp || null;
        const ptr = r.reverse || null;
        try {
          await pool.query(
            `INSERT INTO ip_enrichment (ip, ip_scope, country, asn, org_name, ptr, last_lookup)
             VALUES (?, 'external', ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
               country    = COALESCE(VALUES(country), country),
               asn        = COALESCE(VALUES(asn), asn),
               org_name   = COALESCE(VALUES(org_name), org_name),
               ptr        = COALESCE(VALUES(ptr), ptr),
               last_lookup = VALUES(last_lookup)`,
            [ip, country, asn, org, ptr],
          );
          updated += 1;
        } catch (e) {
          failed += 1;
          failures.push({ ip, error: e.message });
        }
      }
      if (i + 100 < candidates.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    res.json({
      ok: true,
      mode,
      scanned: allIps.length,
      skipped_private: skipped.length,
      looked_up: candidates.length,
      updated,
      failed,
      failures: failures.slice(0, 20),
      message: `${updated} IPs aktualisiert, ${failed} Fehler. Reload mit Strg+Shift+R.`,
    });
  } catch (err) {
    console.error("POST /api/tools/backfill-country error:", err);
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

// ── System Status / Health Checks ────────────────────────────
import os from "os";
// fs already imported at top of file
import https from "https";
import http from "http";
import { execFile } from "child_process";

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

function httpJson(url, { headers = {}, timeoutMs = 5000, insecure = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        headers,
        timeout: timeoutMs,
        agent: u.protocol === "https:" && insecure ? insecureAgent : undefined,
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => resolve({ status: res.statusCode, body: buf }));
      }
    );
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

async function checkDatabase() {
  const t0 = Date.now();
  try {
    const [[r]] = await pool.query("SELECT 1 as ok");
    const [[c]] = await pool.query("SELECT COUNT(*) as n FROM security_events WHERE event_time > NOW() - INTERVAL 1 HOUR");
    return {
      id: "database", label: "MariaDB / logdb",
      status: r.ok === 1 ? "ok" : "warn",
      latency_ms: Date.now() - t0,
      detail: `Verbindung OK · ${c.n} Events in letzter Stunde`,
    };
  } catch (e) {
    return { id: "database", label: "MariaDB / logdb", status: "error", latency_ms: Date.now() - t0, detail: e.message };
  }
}

async function checkApi() {
  return { id: "api", label: "Dashboard API", status: "ok", latency_ms: 0, detail: `Node ${process.version} · uptime ${Math.round(process.uptime())}s` };
}

async function checkOpnsense() {
  const url = process.env.OPNSENSE_HOST || process.env.OPNSENSE_URL;
  const key = process.env.OPNSENSE_API_KEY || process.env.OPNSENSE_KEY;
  const sec = process.env.OPNSENSE_API_SECRET || process.env.OPNSENSE_SECRET;
  if (!url) return { id: "opnsense", label: "OPNsense", status: "skip", detail: "Nicht konfiguriert (OPNSENSE_HOST)" };
  const t0 = Date.now();
  try {
    const auth = "Basic " + Buffer.from(`${key}:${sec}`).toString("base64");
    const r = await httpJson(`${url.replace(/\/$/, "")}/api/core/firmware/status`, {
      headers: { Authorization: auth }, insecure: process.env.OPNSENSE_INSECURE_TLS === "1" || process.env.OPNSENSE_INSECURE === "1",
    });
    return {
      id: "opnsense", label: "OPNsense",
      status: r.status >= 200 && r.status < 300 ? "ok" : "error",
      latency_ms: Date.now() - t0,
      detail: `HTTP ${r.status}`,
    };
  } catch (e) {
    return { id: "opnsense", label: "OPNsense", status: "error", latency_ms: Date.now() - t0, detail: e.message };
  }
}

async function checkMailcow() {
  const url = process.env.MAILCOW_HOST || process.env.MAILCOW_URL;
  const key = process.env.MAILCOW_API_KEY;
  if (!url) return { id: "mailcow", label: "Mailcow", status: "skip", detail: "Nicht konfiguriert (MAILCOW_HOST)" };
  const t0 = Date.now();
  try {
    const r = await httpJson(`${url.replace(/\/$/, "")}/api/v1/get/status/containers`, {
      headers: { "X-API-Key": key || "" }, insecure: process.env.MAILCOW_INSECURE_TLS === "1" || process.env.MAILCOW_INSECURE === "1",
    });
    let detail = `HTTP ${r.status}`;
    if (r.status === 200) {
      try {
        const j = JSON.parse(r.body);
        const total = Object.keys(j).length;
        const running = Object.values(j).filter((c) => c?.state === "running").length;
        detail = `${running}/${total} Container running`;
      } catch { /* ignore */ }
    }
    return { id: "mailcow", label: "Mailcow", status: r.status === 200 ? "ok" : "error", latency_ms: Date.now() - t0, detail };
  } catch (e) {
    return { id: "mailcow", label: "Mailcow", status: "error", latency_ms: Date.now() - t0, detail: e.message };
  }
}

function sshTest(target, keyPath) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const args = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=accept-new"];
    if (keyPath) args.push("-i", keyPath);
    args.push(target, "true");
    execFile("ssh", args, { timeout: 8000 }, (err, _so, se) => {
      resolve({
        target,
        ok: !err,
        latency_ms: Date.now() - t0,
        detail: err ? (se || err.message).toString().split("\n")[0] : "OK",
      });
    });
  });
}

async function checkSshKeys() {
  const targets = (process.env.SSH_TARGETS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const keyPath = process.env.SSH_KEY_PATH;
  if (keyPath && !fs.existsSync(keyPath)) {
    return { id: "ssh", label: "SSH Keys", status: "error", detail: `Key fehlt: ${keyPath}` };
  }
  if (!targets.length) {
    return { id: "ssh", label: "SSH Keys", status: "skip", detail: "Keine SSH_TARGETS konfiguriert (user@host,user@host)" };
  }
  const results = await Promise.all(targets.map((t) => sshTest(t, keyPath)));
  const failed = results.filter((r) => !r.ok);
  return {
    id: "ssh",
    label: "SSH Keys / Remote-Hosts",
    status: failed.length === 0 ? "ok" : failed.length === results.length ? "error" : "warn",
    detail: results.map((r) => `${r.target}: ${r.ok ? "OK" : r.detail}`).join(" · "),
    children: results,
  };
}

async function checkCrowdsec() {
  const url = process.env.CROWDSEC_LAPI_URL;
  if (!url) return { id: "crowdsec", label: "CrowdSec LAPI", status: "skip", detail: "Nicht konfiguriert (CROWDSEC_LAPI_URL)" };
  const t0 = Date.now();
  try {
    const r = await httpJson(`${url.replace(/\/$/, "")}/v1/decisions`, {
      headers: { "X-Api-Key": process.env.CROWDSEC_BOUNCER_KEY || "" }, insecure: true,
    });
    return { id: "crowdsec", label: "CrowdSec LAPI", status: r.status === 200 || r.status === 403 ? "ok" : "error", latency_ms: Date.now() - t0, detail: `HTTP ${r.status}` };
  } catch (e) {
    return { id: "crowdsec", label: "CrowdSec LAPI", status: "error", latency_ms: Date.now() - t0, detail: e.message };
  }
}

async function checkCollectorHeartbeat() {
  try {
    // Compute the age in MariaDB itself to avoid timezone mismatches between
    // the DB server and the API container (mysql2 returns DATETIME as JS Date
    // using the connection's timezone, which can be off by hours).
    // Take the freshest event across the tables the collector writes into.
    const [[r]] = await pool.query(`
      SELECT
        GREATEST(
          COALESCE((SELECT MAX(event_time) FROM security_events), '1970-01-01'),
          COALESCE((SELECT MAX(event_time) FROM auth_events),     '1970-01-01')
        ) AS last,
        TIMESTAMPDIFF(MINUTE,
          GREATEST(
            COALESCE((SELECT MAX(event_time) FROM security_events), '1970-01-01'),
            COALESCE((SELECT MAX(event_time) FROM auth_events),     '1970-01-01')
          ), NOW()) AS age_min
    `);
    if (!r.last || String(r.last).startsWith("1970")) {
      return { id: "collector", label: "Log-Collector Heartbeat", status: "warn", detail: "Keine Events in DB" };
    }
    const ageMin = Number(r.age_min);
    const status = ageMin < 15 ? "ok" : ageMin < 60 ? "warn" : "error";
    return { id: "collector", label: "Log-Collector Heartbeat", status, detail: `Letztes Event vor ${ageMin} min` };
  } catch (e) {
    return { id: "collector", label: "Log-Collector Heartbeat", status: "error", detail: e.message };
  }
}

function checkSystem() {
  const load = os.loadavg();
  const memFree = os.freemem();
  const memTotal = os.totalmem();
  const memUsedPct = Math.round((1 - memFree / memTotal) * 100);
  const status = memUsedPct > 90 || load[0] > os.cpus().length * 2 ? "warn" : "ok";
  return {
    id: "system", label: "VM Ressourcen",
    status,
    detail: `Load ${load[0].toFixed(2)} · RAM ${memUsedPct}% · ${os.cpus().length} CPU`,
  };
}

let healthCache = { at: 0, data: null };
app.get("/api/health/checks", async (_req, res) => {
  if (Date.now() - healthCache.at < 30_000 && healthCache.data) {
    return res.json({ ...healthCache.data, cached: true });
  }
  const checks = await Promise.all([
    checkApi(), checkDatabase(), checkCollectorHeartbeat(),
    checkOpnsense(), checkMailcow(), checkCrowdsec(),
    checkSshKeys(),
  ]);
  checks.push(checkSystem());
  const overall = checks.some((c) => c.status === "error") ? "error"
                : checks.some((c) => c.status === "warn") ? "warn" : "ok";
  const data = { overall, checked_at: new Date().toISOString(), checks };
  healthCache = { at: Date.now(), data };
  res.json(data);
});

// ── SSH Setup Wizard ────────────────────────────────────────
// SSH_KEY_DIR / SSH_KEY_NAME are imported from the bootstrap block at top of file.
// Alias to local names used by the wizard helpers below.
const SSH_KEY_DIR = SSH_DIR;

function runCmd(cmd, args, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        code: err ? (err.code ?? 1) : 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || (err ? err.message : "")),
      });
    });
  });
}

app.get("/api/setup/ssh-pubkey", async (_req, res) => {
  const pubPath = path.join(SSH_KEY_DIR, `${SSH_KEY_NAME}.pub`);
  try {
    const pub = await fs.promises.readFile(pubPath, "utf8");
    res.json({ exists: true, path: pubPath, public_key: pub.trim() });
  } catch {
    res.json({ exists: false, path: pubPath });
  }
});

app.post("/api/setup/ssh-keygen", async (req, res) => {
  try {
    const { comment = "dashboard@logsrv", overwrite = false } = req.body || {};
    await fs.promises.mkdir(SSH_KEY_DIR, { recursive: true, mode: 0o700 });
    const keyPath = path.join(SSH_KEY_DIR, SSH_KEY_NAME);
    if (!overwrite) {
      try {
        await fs.promises.access(keyPath);
        const pub = await fs.promises.readFile(`${keyPath}.pub`, "utf8");
        return res.json({ created: false, reason: "exists", path: keyPath, public_key: pub.trim() });
      } catch {}
    } else {
      await fs.promises.unlink(keyPath).catch(() => {});
      await fs.promises.unlink(`${keyPath}.pub`).catch(() => {});
    }
    const r = await runCmd("ssh-keygen", ["-t","ed25519","-f",keyPath,"-N","","-C",comment]);
    if (!r.ok) return res.status(500).json({ created: false, error: r.stderr || "ssh-keygen failed" });
    const pub = await fs.promises.readFile(`${keyPath}.pub`, "utf8");
    res.json({ created: true, path: keyPath, public_key: pub.trim() });
  } catch (err) {
    res.status(500).json({ created: false, error: err.message });
  }
});

app.post("/api/setup/ssh-test", async (req, res) => {
  const { host, user, port = 22, command = "echo ok" } = req.body || {};
  if (!host || !user) return res.status(400).json({ ok: false, error: "host and user required" });
  const keyPath = path.join(SSH_KEY_DIR, SSH_KEY_NAME);
  try { await fs.promises.access(keyPath); } catch {
    return res.status(400).json({ ok: false, error: "SSH-Key fehlt – bitte zuerst generieren." });
  }
  const t0 = Date.now();
  const r = await runCmd("ssh", [
    "-i", keyPath, "-p", String(port),
    "-o","BatchMode=yes",
    "-o","StrictHostKeyChecking=accept-new",
    "-o","ConnectTimeout=6",
    "-o","UserKnownHostsFile=" + path.join(SSH_KEY_DIR, "known_hosts"),
    `${user}@${host}`, command,
  ], { timeoutMs: 10000 });
  res.json({
    ok: r.ok, code: r.code, latency_ms: Date.now() - t0,
    stdout: r.stdout.trim().slice(0, 500),
    stderr: r.stderr.trim().slice(0, 500),
    hint: !r.ok && /Permission denied/i.test(r.stderr)
      ? "Public Key noch nicht auf dem Ziel hinterlegt."
      : !r.ok && /resolve|refused|timed out|No route/i.test(r.stderr)
        ? "Host nicht erreichbar (DNS / Port / Firewall)."
        : undefined,
  });
});

// ─────────────────────────────────────────────────────────────
// Remote integrations: SSH ping, OPNsense API, Mailcow API,
// CrowdSec LAPI. All read env vars; if not configured, returns
// 503 with a helpful message instead of crashing.
// ─────────────────────────────────────────────────────────────

// shared insecureAgent / http helpers are defined further up in this file
// (see ~line 724). We reuse them here.

// Low-level https request that supports a body and self-signed certs.
function intHttpRequest(targetUrl, { method = "GET", headers = {}, body, insecure = false, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(targetUrl); } catch (e) { return reject(e); }
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request({
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + (u.search || ""),
      headers,
      ...(u.protocol === "https:" && insecure ? { rejectUnauthorized: false } : {}),
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode || 0, headers: res.headers, body: buf });
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

function parseRemoteHosts() {
  const raw = process.env.REMOTE_HOSTS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean).map((entry) => {
    const m = entry.match(/^([^@]+)@(.+?)(?::(\d+))?$/);
    if (!m) return null;
    return { user: m[1], host: m[2], port: parseInt(m[3] || "22", 10), id: entry };
  }).filter(Boolean);
}

async function sshExec({ user, host, port = 22, command, timeoutMs = 10000 }) {
  const keyPath = path.join(SSH_KEY_DIR, SSH_KEY_NAME);
  try { await fs.promises.access(keyPath); } catch {
    return { ok: false, error: "SSH-Key fehlt – /api/setup/ssh-keygen aufrufen." };
  }
  const t0 = Date.now();
  const r = await runCmd("ssh", [
    "-i", keyPath, "-p", String(port),
    "-o","BatchMode=yes",
    "-o","StrictHostKeyChecking=accept-new",
    "-o","ConnectTimeout=6",
    "-o","UserKnownHostsFile=" + path.join(SSH_KEY_DIR, "known_hosts"),
    `${user}@${host}`, command,
  ], { timeoutMs });
  return { ok: r.ok, code: r.code, latency_ms: Date.now() - t0,
           stdout: r.stdout.trim(), stderr: r.stderr.trim() };
}

// GET /api/remote/hosts – list configured SSH targets (no secrets)
app.get("/api/remote/hosts", (_req, res) => {
  res.json({ hosts: parseRemoteHosts().map(({ id, user, host, port }) => ({ id, user, host, port })) });
});

// GET /api/remote/ping?host=user@ip  – simple uptime probe via SSH
app.get("/api/remote/ping", async (req, res) => {
  const target = String(req.query.host || "").trim();
  const all = parseRemoteHosts();
  const t = target ? all.find((h) => h.id === target) : null;
  if (!t) return res.status(400).json({ ok: false, error: "host nicht in REMOTE_HOSTS gefunden", available: all.map((h) => h.id) });
  const r = await sshExec({ ...t, command: "uptime && echo --- && df -h / | tail -1" });
  res.json({ host: t.id, ...r });
});

// GET /api/remote/status – ping all configured hosts in parallel
app.get("/api/remote/status", async (_req, res) => {
  const hosts = parseRemoteHosts();
  if (!hosts.length) return res.json({ hosts: [], note: "REMOTE_HOSTS leer" });
  const results = await Promise.all(hosts.map(async (h) => {
    const r = await sshExec({ ...h, command: "uptime", timeoutMs: 8000 });
    return { id: h.id, ok: r.ok, latency_ms: r.latency_ms, uptime: r.ok ? r.stdout : null, error: r.ok ? null : (r.stderr || r.error) };
  }));
  res.json({ hosts: results, checked_at: new Date().toISOString() });
});

// ── OPNsense ────────────────────────────────────────────────
function opnsenseAuthHeader() {
  const k = process.env.OPNSENSE_API_KEY, s = process.env.OPNSENSE_API_SECRET;
  if (!k || !s) return null;
  return "Basic " + Buffer.from(`${k}:${s}`).toString("base64");
}

async function opnsenseCall(pathname) {
  const base = process.env.OPNSENSE_HOST;
  const auth = opnsenseAuthHeader();
  if (!base || !auth) {
    return { configured: false, error: "OPNSENSE_HOST / API_KEY / API_SECRET fehlen" };
  }
  const insecure = (process.env.OPNSENSE_INSECURE_TLS || "1") === "1";
  const url = base.replace(/\/+$/, "") + pathname;
  const t0 = Date.now();
  try {
    const r = await intHttpRequest(url, { headers: { Authorization: auth, Accept: "application/json" }, insecure, timeoutMs: 8000 });
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch { parsed = { raw: r.body.slice(0, 400) }; }
    return { configured: true, ok: r.status >= 200 && r.status < 300, status: r.status, latency_ms: Date.now() - t0, data: parsed };
  } catch (e) {
    return { configured: true, ok: false, error: e.message, latency_ms: Date.now() - t0 };
  }
}

// GET /api/opnsense/status – simple "is the API reachable?" probe
app.get("/api/opnsense/status", async (_req, res) => {
  const r = await opnsenseCall("/api/core/firmware/status");
  if (!r.configured) return res.status(503).json(r);
  res.json(r);
});

// GET /api/opnsense/aliases
app.get("/api/opnsense/aliases", async (_req, res) => {
  const r = await opnsenseCall("/api/firewall/alias/get");
  if (!r.configured) return res.status(503).json(r);
  res.json(r);
});

// ── Mailcow ─────────────────────────────────────────────────
async function mailcowCall(pathname) {
  const base = process.env.MAILCOW_HOST;
  const key = process.env.MAILCOW_API_KEY;
  if (!base || !key) return { configured: false, error: "MAILCOW_HOST / MAILCOW_API_KEY fehlen" };
  const insecure = (process.env.MAILCOW_INSECURE_TLS || "1") === "1";
  const url = base.replace(/\/+$/, "") + pathname;
  const t0 = Date.now();
  try {
    const r = await intHttpRequest(url, { headers: { "X-API-Key": key, Accept: "application/json" }, insecure, timeoutMs: 8000 });
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch { parsed = { raw: r.body.slice(0, 400) }; }
    return { configured: true, ok: r.status >= 200 && r.status < 300, status: r.status, latency_ms: Date.now() - t0, data: parsed };
  } catch (e) {
    return { configured: true, ok: false, error: e.message, latency_ms: Date.now() - t0 };
  }
}

// GET /api/mailcow/status – queue size + version
app.get("/api/mailcow/status", async (_req, res) => {
  const [version, queue] = await Promise.all([
    mailcowCall("/api/v1/get/status/version"),
    mailcowCall("/api/v1/get/mailq/all"),
  ]);
  if (!version.configured) return res.status(503).json(version);
  const queueLen = Array.isArray(queue.data) ? queue.data.length : null;
  res.json({
    ok: version.ok && queue.ok,
    version: version.data,
    queue_size: queueLen,
    latency_ms: Math.max(version.latency_ms || 0, queue.latency_ms || 0),
  });
});

// ── CrowdSec LAPI ───────────────────────────────────────────
async function crowdsecCall(pathname) {
  const base = process.env.CROWDSEC_LAPI_URL;
  const key = process.env.CROWDSEC_BOUNCER_KEY;
  if (!base || !key) return { configured: false, error: "CROWDSEC_LAPI_URL / CROWDSEC_BOUNCER_KEY fehlen" };
  const url = base.replace(/\/+$/, "") + pathname;
  const t0 = Date.now();
  try {
    const r = await intHttpRequest(url, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      insecure: true, timeoutMs: 8000,
    });
    let parsed = null;
    try { parsed = JSON.parse(r.body); } catch { parsed = { raw: r.body.slice(0, 400) }; }
    return { configured: true, ok: r.status >= 200 && r.status < 300, status: r.status, latency_ms: Date.now() - t0, data: parsed };
  } catch (e) {
    return { configured: true, ok: false, error: e.message, latency_ms: Date.now() - t0 };
  }
}

// GET /api/crowdsec/decisions – active bans/decisions
app.get("/api/crowdsec/decisions", async (_req, res) => {
  const r = await crowdsecCall("/v1/decisions");
  if (!r.configured) return res.status(503).json(r);
  const list = Array.isArray(r.data) ? r.data : [];
  res.json({
    ok: r.ok, status: r.status, latency_ms: r.latency_ms,
    count: list.length,
    decisions: list.slice(0, 200).map((d) => ({
      id: d.id, type: d.type, scope: d.scope, value: d.value,
      origin: d.origin, scenario: d.scenario, duration: d.duration, until: d.until,
    })),
  });
});

// GET /api/integrations/status – overview tile
app.get("/api/integrations/status", async (_req, res) => {
  const [opn, mc, cs, hosts] = await Promise.all([
    opnsenseCall("/api/core/firmware/status"),
    mailcowCall("/api/v1/get/status/version"),
    crowdsecCall("/v1/decisions"),
    (async () => {
      const list = parseRemoteHosts();
      if (!list.length) return { configured: false };
      const results = await Promise.all(list.map(async (h) => {
        const r = await sshExec({ ...h, command: "uptime", timeoutMs: 6000 });
        return { id: h.id, ok: r.ok, latency_ms: r.latency_ms };
      }));
      return { configured: true, hosts: results };
    })(),
  ]);
  res.json({
    checked_at: new Date().toISOString(),
    opnsense:  { configured: !!opn.configured, ok: !!opn.ok, status: opn.status, latency_ms: opn.latency_ms, error: opn.error },
    mailcow:   { configured: !!mc.configured,  ok: !!mc.ok,  status: mc.status,  latency_ms: mc.latency_ms,  error: mc.error  },
    crowdsec:  { configured: !!cs.configured,  ok: !!cs.ok,  status: cs.status,  latency_ms: cs.latency_ms,  error: cs.error,
                 active_decisions: Array.isArray(cs.data) ? cs.data.length : null },
    ssh: hosts,
  });
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard API listening on :${PORT}`);
  console.log(
    `[startup] MariaDB target: ${process.env.MARIADB_USER || "loguser"}@${process.env.MARIADB_HOST || "host.docker.internal"}:${process.env.MARIADB_PORT || "3306"}/${process.env.MARIADB_DATABASE || "logdb"}`
  );
  // Probe DB once at boot so the real error (auth, host, port, db missing) is
  // visible in `docker compose logs api` instead of surfacing only on first
  // request as an opaque 502.
  pool.query("SELECT 1")
    .then(() => console.log("[startup] DB connection OK"))
    .catch((err) => console.error("[startup] DB connection FAILED:", err.code || err.message));
});

// Catch unhandled errors so the process logs them instead of dying silently.
process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));

