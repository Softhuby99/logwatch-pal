/**
 * Geo Attack Aggregator
 *
 * Aggregiert Angriffe pro Country (basierend auf ip_enrichment + security_events + auth_events).
 * Liefert Daten für Choropleth-Weltkarte und Country-Drilldown.
 *
 * Spätere FastAPI:
 *   GET /api/geo/countries
 *   GET /api/geo/country/{iso2}
 */

import {
  mockSecurityEvents,
  mockAuthEvents,
  mockIPEnrichment,
  mockIPRiskScore,
} from "@/data/mockSecurityData";
import type { AlertLevel } from "@/types/database";

// ============================================================
// ISO2 → ISO3 + Country Name (nur für Länder, die in Mocks vorkommen
// + gängige Top-Quellländer). TopoJSON-Karte nutzt ISO_A3.
// ============================================================

interface CountryInfo {
  iso3: string;
  name: string;
}

const COUNTRY_TABLE: Record<string, CountryInfo> = {
  RU: { iso3: "RUS", name: "Russland" },
  UA: { iso3: "UKR", name: "Ukraine" },
  BD: { iso3: "BGD", name: "Bangladesch" },
  NL: { iso3: "NLD", name: "Niederlande" },
  GB: { iso3: "GBR", name: "Großbritannien" },
  EE: { iso3: "EST", name: "Estland" },
  US: { iso3: "USA", name: "USA" },
  DE: { iso3: "DEU", name: "Deutschland" },
  CN: { iso3: "CHN", name: "China" },
  IN: { iso3: "IND", name: "Indien" },
  BR: { iso3: "BRA", name: "Brasilien" },
  FR: { iso3: "FRA", name: "Frankreich" },
  IT: { iso3: "ITA", name: "Italien" },
  ES: { iso3: "ESP", name: "Spanien" },
  PL: { iso3: "POL", name: "Polen" },
  TR: { iso3: "TUR", name: "Türkei" },
  IR: { iso3: "IRN", name: "Iran" },
  KP: { iso3: "PRK", name: "Nordkorea" },
  KR: { iso3: "KOR", name: "Südkorea" },
  JP: { iso3: "JPN", name: "Japan" },
  VN: { iso3: "VNM", name: "Vietnam" },
  ID: { iso3: "IDN", name: "Indonesien" },
  PK: { iso3: "PAK", name: "Pakistan" },
  RO: { iso3: "ROU", name: "Rumänien" },
  BG: { iso3: "BGR", name: "Bulgarien" },
  CZ: { iso3: "CZE", name: "Tschechien" },
  CH: { iso3: "CHE", name: "Schweiz" },
  AT: { iso3: "AUT", name: "Österreich" },
  SE: { iso3: "SWE", name: "Schweden" },
  CA: { iso3: "CAN", name: "Kanada" },
  HK: { iso3: "HKG", name: "Hongkong" },
  SG: { iso3: "SGP", name: "Singapur" },
  AE: { iso3: "ARE", name: "Vereinigte Arabische Emirate" },
  ZA: { iso3: "ZAF", name: "Südafrika" },
  MX: { iso3: "MEX", name: "Mexiko" },
  AR: { iso3: "ARG", name: "Argentinien" },
};

export const iso2ToIso3 = (iso2: string | null | undefined): string | null =>
  iso2 ? COUNTRY_TABLE[iso2.toUpperCase()]?.iso3 ?? null : null;

export const iso2ToName = (iso2: string | null | undefined): string =>
  iso2 ? COUNTRY_TABLE[iso2.toUpperCase()]?.name ?? iso2 : "Unbekannt";

export const iso3ToIso2 = (iso3: string): string | null => {
  const upper = iso3.toUpperCase();
  for (const [k, v] of Object.entries(COUNTRY_TABLE)) {
    if (v.iso3 === upper) return k;
  }
  return null;
};

// ============================================================
// Country Aggregation
// ============================================================

export interface CountryAttackStat {
  iso2: string;
  iso3: string | null;
  name: string;
  unique_ips: number;
  total_events: number;
  bans: number;
  auth_failures: number;
  crit_events: number;
  warn_events: number;
  max_risk_score: number;
  /** Basis für Choropleth-Färbung (gewichtete Summe) */
  attack_weight: number;
}

const eventCountByIp = (): Map<string, { events: number; bans: number; authFails: number; crit: number; warn: number }> => {
  const map = new Map<
    string,
    { events: number; bans: number; authFails: number; crit: number; warn: number }
  >();

  const bump = (ip: string, alert: AlertLevel, isBan: boolean, isAuthFail: boolean) => {
    const cur = map.get(ip) ?? { events: 0, bans: 0, authFails: 0, crit: 0, warn: 0 };
    cur.events++;
    if (isBan) cur.bans++;
    if (isAuthFail) cur.authFails++;
    if (alert === "CRIT") cur.crit++;
    else if (alert === "WARN") cur.warn++;
    map.set(ip, cur);
  };

  mockSecurityEvents.forEach((e) => {
    bump(e.ip, e.alert_level, e.ban_status === "banning", false);
  });
  mockAuthEvents.forEach((e) => {
    if (!e.ip) return;
    bump(e.ip, e.alert_level, false, e.auth_status === "failed");
  });

  return map;
};

export const getCountryAttackStats = (): CountryAttackStat[] => {
  const ipStats = eventCountByIp();
  const map = new Map<string, CountryAttackStat>();

  mockIPEnrichment.forEach((enr) => {
    if (!enr.country) return;
    if (enr.ip_scope !== "external") return; // interne IPs aus Karte ausschließen
    const iso2 = enr.country.toUpperCase();
    const stats = ipStats.get(enr.ip);
    if (!stats || stats.events === 0) return;
    const risk = mockIPRiskScore.find((r) => r.ip === enr.ip);
    const cur = map.get(iso2) ?? {
      iso2,
      iso3: iso2ToIso3(iso2),
      name: iso2ToName(iso2),
      unique_ips: 0,
      total_events: 0,
      bans: 0,
      auth_failures: 0,
      crit_events: 0,
      warn_events: 0,
      max_risk_score: 0,
      attack_weight: 0,
    };
    cur.unique_ips++;
    cur.total_events += stats.events;
    cur.bans += stats.bans;
    cur.auth_failures += stats.authFails;
    cur.crit_events += stats.crit;
    cur.warn_events += stats.warn;
    cur.max_risk_score = Math.max(cur.max_risk_score, risk?.score ?? 0);
    // gewichtet: bans×3 + crit×2 + events
    cur.attack_weight += stats.bans * 3 + stats.crit * 2 + stats.events;
    map.set(iso2, cur);
  });

  return Array.from(map.values()).sort((a, b) => b.attack_weight - a.attack_weight);
};

// ============================================================
// Country Drilldown: IPs aus diesem Land
// ============================================================

export interface CountryIpRow {
  ip: string;
  events: number;
  bans: number;
  auth_failures: number;
  last_alert: AlertLevel;
  org_name: string | null;
  asn: string | null;
  ptr: string | null;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRIT";
}

export interface CountryDetail {
  iso2: string;
  iso3: string | null;
  name: string;
  ips: CountryIpRow[];
  totals: {
    unique_ips: number;
    total_events: number;
    bans: number;
    auth_failures: number;
  };
}

export const getCountryDetail = (iso2: string): CountryDetail => {
  const upper = iso2.toUpperCase();
  const ipStats = eventCountByIp();

  const enrichments = mockIPEnrichment.filter(
    (e) => e.country?.toUpperCase() === upper && e.ip_scope === "external"
  );

  const ips: CountryIpRow[] = enrichments
    .map((enr) => {
      const s = ipStats.get(enr.ip);
      if (!s || s.events === 0) return null;
      const risk = mockIPRiskScore.find((r) => r.ip === enr.ip);
      // letztes alert level grob über security_events ableiten
      const lastSec = mockSecurityEvents
        .filter((e) => e.ip === enr.ip)
        .sort((a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime())[0];
      const last_alert: AlertLevel = lastSec?.alert_level ?? (s.crit > 0 ? "CRIT" : s.warn > 0 ? "WARN" : "INFO");
      return {
        ip: enr.ip,
        events: s.events,
        bans: s.bans,
        auth_failures: s.authFails,
        last_alert,
        org_name: enr.org_name,
        asn: enr.asn,
        ptr: enr.ptr,
        risk_score: risk?.score ?? 0,
        risk_level: risk?.risk_level ?? "LOW",
      } as CountryIpRow;
    })
    .filter((x): x is CountryIpRow => x !== null)
    .sort((a, b) => b.risk_score - a.risk_score || b.events - a.events);

  return {
    iso2: upper,
    iso3: iso2ToIso3(upper),
    name: iso2ToName(upper),
    ips,
    totals: {
      unique_ips: ips.length,
      total_events: ips.reduce((s, x) => s + x.events, 0),
      bans: ips.reduce((s, x) => s + x.bans, 0),
      auth_failures: ips.reduce((s, x) => s + x.auth_failures, 0),
    },
  };
};
