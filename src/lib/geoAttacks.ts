/**
 * Geo Attack Aggregator (Live-API)
 *
 * Fetcht aggregierte Angriffsstatistik pro Land aus der Dashboard-API
 * (Quelle: MariaDB ip_summary + ip_enrichment + ip_risk_score).
 *
 * Endpunkte:
 *   GET /api/geo-attacks          → CountryAttackStat[]
 *   GET /api/geo/country/:iso2    → CountryDetail
 */

import type { AlertLevel } from "@/types/database";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function apiFetch<T>(path: string, fallback: T): Promise<{ data: T; live: boolean }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: (await res.json()) as T, live: true };
  } catch {
    return { data: fallback, live: false };
  }
}

// ============================================================
// ISO2 → ISO3 + Country Name (TopoJSON nutzt ISO-Numeric als geo.id)
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
// Types
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
  attack_weight: number;
  /** Reserviert: aktuell keine echten Regions-Daten in ip_enrichment. */
  regions: RegionAttackStat[];
}

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

// ============================================================
// API Fetchers (für useApiData)
// ============================================================

interface ApiCountryRow {
  country: string;
  unique_ips?: number;
  total_events?: number;
  bans?: number;
  auth_failures?: number;
  crit_events?: number;
  warn_events?: number;
  max_risk_score?: number;
  attack_weight?: number;
  count?: number;
}

export const fetchCountryAttackStats = async (): Promise<{
  data: CountryAttackStat[];
  live: boolean;
}> => {
  const { data, live } = await apiFetch<ApiCountryRow[]>("/geo-attacks", []);
  const list: CountryAttackStat[] = (data || [])
    .filter((r) => !!r.country)
    .map((r) => {
      const iso2 = String(r.country).toUpperCase();
      const events = Number(r.total_events ?? r.count ?? 0);
      const bans = Number(r.bans ?? 0);
      const crit = Number(r.crit_events ?? 0);
      return {
        iso2,
        iso3: iso2ToIso3(iso2),
        name: iso2ToName(iso2),
        unique_ips: Number(r.unique_ips ?? 0),
        total_events: events,
        bans,
        auth_failures: Number(r.auth_failures ?? 0),
        crit_events: crit,
        warn_events: Number(r.warn_events ?? 0),
        max_risk_score: Number(r.max_risk_score ?? 0),
        attack_weight: Number(r.attack_weight ?? bans * 3 + crit * 2 + events),
        regions: [],
      };
    })
    .sort((a, b) => b.attack_weight - a.attack_weight);
  return { data: list, live };
};

interface ApiCountryDetail {
  iso2: string;
  ips: CountryIpRow[];
  totals: CountryDetail["totals"];
}

export const fetchCountryDetail = async (
  iso2: string,
): Promise<{ data: CountryDetail; live: boolean }> => {
  const upper = iso2.toUpperCase();
  const fallback: ApiCountryDetail = {
    iso2: upper,
    ips: [],
    totals: { unique_ips: 0, total_events: 0, bans: 0, auth_failures: 0 },
  };
  const { data, live } = await apiFetch<ApiCountryDetail>(
    `/geo/country/${upper}`,
    fallback,
  );
  return {
    data: {
      iso2: upper,
      iso3: iso2ToIso3(upper),
      name: iso2ToName(upper),
      ips: data.ips || [],
      totals: data.totals || fallback.totals,
    },
    live,
  };
};
