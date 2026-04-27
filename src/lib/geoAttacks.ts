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
  /** ISO numeric (3-stellig, gepolstert) – key in world-atlas TopoJSON */
  isoN: string;
  name: string;
}

const COUNTRY_TABLE: Record<string, CountryInfo> = {
  RU: { iso3: "RUS", isoN: "643", name: "Russland" },
  UA: { iso3: "UKR", isoN: "804", name: "Ukraine" },
  BD: { iso3: "BGD", isoN: "050", name: "Bangladesch" },
  NL: { iso3: "NLD", isoN: "528", name: "Niederlande" },
  GB: { iso3: "GBR", isoN: "826", name: "Großbritannien" },
  EE: { iso3: "EST", isoN: "233", name: "Estland" },
  US: { iso3: "USA", isoN: "840", name: "USA" },
  DE: { iso3: "DEU", isoN: "276", name: "Deutschland" },
  CN: { iso3: "CHN", isoN: "156", name: "China" },
  IN: { iso3: "IND", isoN: "356", name: "Indien" },
  BR: { iso3: "BRA", isoN: "076", name: "Brasilien" },
  FR: { iso3: "FRA", isoN: "250", name: "Frankreich" },
  IT: { iso3: "ITA", isoN: "380", name: "Italien" },
  ES: { iso3: "ESP", isoN: "724", name: "Spanien" },
  PL: { iso3: "POL", isoN: "616", name: "Polen" },
  TR: { iso3: "TUR", isoN: "792", name: "Türkei" },
  IR: { iso3: "IRN", isoN: "364", name: "Iran" },
  KP: { iso3: "PRK", isoN: "408", name: "Nordkorea" },
  KR: { iso3: "KOR", isoN: "410", name: "Südkorea" },
  JP: { iso3: "JPN", isoN: "392", name: "Japan" },
  VN: { iso3: "VNM", isoN: "704", name: "Vietnam" },
  ID: { iso3: "IDN", isoN: "360", name: "Indonesien" },
  PK: { iso3: "PAK", isoN: "586", name: "Pakistan" },
  RO: { iso3: "ROU", isoN: "642", name: "Rumänien" },
  BG: { iso3: "BGR", isoN: "100", name: "Bulgarien" },
  CZ: { iso3: "CZE", isoN: "203", name: "Tschechien" },
  CH: { iso3: "CHE", isoN: "756", name: "Schweiz" },
  AT: { iso3: "AUT", isoN: "040", name: "Österreich" },
  SE: { iso3: "SWE", isoN: "752", name: "Schweden" },
  CA: { iso3: "CAN", isoN: "124", name: "Kanada" },
  HK: { iso3: "HKG", isoN: "344", name: "Hongkong" },
  SG: { iso3: "SGP", isoN: "702", name: "Singapur" },
  AE: { iso3: "ARE", isoN: "784", name: "Vereinigte Arabische Emirate" },
  ZA: { iso3: "ZAF", isoN: "710", name: "Südafrika" },
  MX: { iso3: "MEX", isoN: "484", name: "Mexiko" },
  AR: { iso3: "ARG", isoN: "032", name: "Argentinien" },
};

export const iso2ToIsoN = (iso2: string | null | undefined): string | null =>
  iso2 ? COUNTRY_TABLE[iso2.toUpperCase()]?.isoN ?? null : null;

export const isoNToIso2 = (isoN: string): string | null => {
  const padded = String(isoN).padStart(3, "0");
  for (const [k, v] of Object.entries(COUNTRY_TABLE)) {
    if (v.isoN === padded) return k;
  }
  return null;
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

export interface RegionAttackStat {
  region: string;
  unique_ips: number;
  total_events: number;
  bans: number;
}

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
  /** Aufschlüsselung pro Region (für Bubble-Marker auf der Karte) */
  regions: RegionAttackStat[];
}

// ----- Mock-Region per IP (deterministisch) -----
// Für die Demo gibt es keine echten Region-Daten in mockIPEnrichment.
// Wir leiten pro Land aus einer kurzen Region-Liste deterministisch über
// einen Hash der IP eine Region ab. Das produziert stabile, plausible Daten
// (gleiche IP → gleiche Region) – die echte FastAPI ersetzt das später durch
// die `region`-Spalte aus der ip_enrichment Tabelle.
const REGIONS_BY_COUNTRY: Record<string, string[]> = {
  RU: ["Moskau", "St. Petersburg", "Nowosibirsk", "Jekaterinburg"],
  UA: ["Kyiv", "Charkiw", "Odessa", "Lwiw"],
  BD: ["Dhaka", "Chittagong", "Khulna"],
  NL: ["Nordholland", "Südholland", "Utrecht"],
  GB: ["London", "Manchester", "Edinburgh"],
  EE: ["Harju", "Tartu"],
  US: ["California", "Virginia", "Texas", "New York", "Oregon"],
  DE: ["Berlin", "Bayern", "Hessen", "Nordrhein-Westfalen"],
  CN: ["Peking", "Shanghai", "Guangdong", "Zhejiang"],
  IN: ["Maharashtra", "Karnataka", "Delhi", "Tamil Nadu"],
  BR: ["São Paulo", "Rio de Janeiro", "Minas Gerais"],
  FR: ["Île-de-France", "Provence", "Auvergne-Rhône-Alpes"],
  IT: ["Lombardei", "Latium", "Kampanien"],
  ES: ["Madrid", "Katalonien", "Andalusien"],
  PL: ["Masowien", "Schlesien", "Pommern"],
  TR: ["Istanbul", "Ankara", "Izmir"],
  IR: ["Teheran", "Isfahan", "Maschhad"],
  KP: ["Pjöngjang"],
  KR: ["Seoul", "Busan"],
  JP: ["Tokio", "Osaka"],
  VN: ["Hanoi", "Ho-Chi-Minh-Stadt"],
  ID: ["Jakarta", "Java"],
  PK: ["Punjab", "Sindh"],
  RO: ["București", "Cluj"],
  BG: ["Sofia"],
  CZ: ["Prag"],
  CH: ["Zürich", "Genf"],
  AT: ["Wien", "Steiermark"],
  SE: ["Stockholm"],
  CA: ["Ontario", "Quebec"],
  HK: ["Hongkong"],
  SG: ["Singapur"],
  AE: ["Dubai", "Abu Dhabi"],
  ZA: ["Gauteng", "Westkap"],
  MX: ["CDMX", "Jalisco"],
  AR: ["Buenos Aires"],
};

const hashString = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export const regionForIp = (iso2: string, ip: string): string => {
  const list = REGIONS_BY_COUNTRY[iso2.toUpperCase()] ?? ["Unbekannt"];
  return list[hashString(ip) % list.length];
};

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
