import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, MousePointerClick, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCountryAttackStats,
  isoNToIso2,
  iso2ToName,
  type CountryAttackStat,
} from "@/lib/geoAttacks";
import CountryDetailSheet from "./CountryDetailSheet";

// World atlas TopoJSON (countries-110m, IDs sind ISO-Numeric als string z.B. "643")
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const countryFlag = (iso2: string) => {
  if (!iso2 || iso2.length !== 2) return "🌐";
  const codePoints = iso2
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

interface TooltipState {
  x: number;
  y: number;
  iso2: string;
  stat: CountryAttackStat | null;
  fallbackName: string;
}

const GeoAttackMap = () => {
  const stats = useMemo(() => getCountryAttackStats(), []);
  const statsByIso2 = useMemo(() => {
    const m = new Map<string, CountryAttackStat>();
    stats.forEach((s) => m.set(s.iso2, s));
    return m;
  }, [stats]);

  const maxWeight = useMemo(
    () => Math.max(1, ...stats.map((s) => s.attack_weight)),
    [stats]
  );

  const colorScale = useMemo(
    () =>
      scaleLinear<string>()
        .domain([0, maxWeight * 0.25, maxWeight * 0.6, maxWeight])
        // dunkelgrün → gelb → orange → rot (HSL passt zum Theme)
        .range([
          "hsl(217 32% 14%)", // sehr dunkel = keine/wenige Angriffe
          "hsl(38 92% 30%)",
          "hsl(20 90% 45%)",
          "hsl(0 84% 55%)",
        ])
        .clamp(true),
    [maxWeight]
  );

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([10, 30]);

  const handleClickCountry = (iso2: string | null, hasData: boolean) => {
    if (!iso2 || !hasData) return;
    setSelectedIso2(iso2);
    setSheetOpen(true);
  };

  const top5 = stats.slice(0, 5);

  return (
    <>
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="px-4 py-2 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-normal text-foreground tracking-wide flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              GeoIP · Angriffsherkunft
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                <MousePointerClick className="h-3 w-3" />
                Land anklicken für IPs
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setZoom((z) => Math.min(z * 1.4, 8))}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setZoom((z) => Math.max(z / 1.4, 1))}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setZoom(1);
                    setCenter([10, 30]);
                  }}
                  aria-label="Reset"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          {/* Legende */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Intensität:</span>
            <div className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded-sm border border-border/30" style={{ background: "hsl(217 32% 14%)" }} />
              <span className="text-[10px] text-muted-foreground">keine</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded-sm" style={{ background: "hsl(38 92% 30%)" }} />
              <span className="text-[10px] text-muted-foreground">niedrig</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded-sm" style={{ background: "hsl(20 90% 45%)" }} />
              <span className="text-[10px] text-muted-foreground">mittel</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-2.5 rounded-sm" style={{ background: "hsl(0 84% 55%)" }} />
              <span className="text-[10px] text-muted-foreground">hoch</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
              {stats.length} Land{stats.length === 1 ? "" : "e"} aktiv ·{" "}
              {stats.reduce((s, c) => s + c.unique_ips, 0)} IPs ·{" "}
              {stats.reduce((s, c) => s + c.total_events, 0)} Events
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 130 }}
              width={900}
              height={420}
              style={{ width: "100%", height: "auto", background: "hsl(222 47% 8%)" }}
            >
              <ZoomableGroup
                zoom={zoom}
                center={center}
                onMoveEnd={({ coordinates, zoom: z }) => {
                  setCenter(coordinates as [number, number]);
                  setZoom(z);
                }}
                maxZoom={8}
                minZoom={1}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const isoN = String(geo.id);
                      const iso2 = isoNToIso2(isoN);
                      const stat = iso2 ? statsByIso2.get(iso2) : undefined;
                      const fillColor = stat
                        ? (colorScale(stat.attack_weight) as string)
                        : "hsl(217 32% 14%)";
                      const hasData = !!stat;
                      const fallbackName: string = geo.properties?.name ?? "Unbekannt";

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fillColor}
                          stroke="hsl(217 32% 22%)"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: "none", cursor: hasData ? "pointer" : "default" },
                            hover: {
                              outline: "none",
                              fill: hasData ? "hsl(199 89% 60%)" : "hsl(217 32% 22%)",
                              stroke: hasData ? "hsl(199 89% 60%)" : "hsl(217 32% 30%)",
                              strokeWidth: hasData ? 0.8 : 0.5,
                              cursor: hasData ? "pointer" : "default",
                            },
                            pressed: { outline: "none" },
                          }}
                          onClick={() => handleClickCountry(iso2, hasData)}
                          onMouseEnter={(e) => {
                            const target = e.currentTarget as SVGPathElement;
                            const containerRect = target.ownerSVGElement?.parentElement?.getBoundingClientRect();
                            const rect = target.getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2 - (containerRect?.left ?? 0),
                              y: rect.top - (containerRect?.top ?? 0),
                              iso2: iso2 ?? "??",
                              stat: stat ?? null,
                              fallbackName,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
                style={{ left: tooltip.x, top: tooltip.y - 6 }}
              >
                <div className="bg-popover border border-border/60 rounded px-2.5 py-1.5 shadow-lg text-xs font-mono whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <span className="text-base leading-none">
                      {tooltip.iso2 !== "??" ? countryFlag(tooltip.iso2) : "🌐"}
                    </span>
                    <span className="font-semibold">
                      {tooltip.stat ? tooltip.stat.name : tooltip.fallbackName}
                    </span>
                    {tooltip.iso2 !== "??" && (
                      <span className="text-muted-foreground">({tooltip.iso2})</span>
                    )}
                  </div>
                  {tooltip.stat ? (
                    <div className="mt-1 space-y-0.5 text-[11px]">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">IPs:</span>
                        <span className="text-foreground">{tooltip.stat.unique_ips}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Events:</span>
                        <span className="text-foreground">{tooltip.stat.total_events}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Bans:</span>
                        <span className="text-red-400">{tooltip.stat.bans}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Auth-Fail:</span>
                        <span className="text-amber-400">{tooltip.stat.auth_failures}</span>
                      </div>
                      <div className="text-[10px] text-primary mt-1 flex items-center gap-1">
                        <MousePointerClick className="h-2.5 w-2.5" />
                        Klick für Details
                      </div>
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      Keine Angriffe erfasst
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Top 5 Liste unterhalb der Karte */}
          {top5.length > 0 && (
            <div className="border-t border-border/30 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Top 5 Quellländer
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {top5.map((c) => (
                  <button
                    key={c.iso2}
                    onClick={() => handleClickCountry(c.iso2, true)}
                    className="text-left border border-border/30 rounded p-2 bg-card/40 hover:bg-card/70 hover:border-primary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{countryFlag(c.iso2)}</span>
                      <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                        {c.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 font-mono bg-card/60 border-border/40 text-muted-foreground"
                      >
                        {c.unique_ips} IPs
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 font-mono bg-card/60 border-border/40 text-foreground"
                      >
                        {c.total_events} Ev
                      </Badge>
                      {c.bans > 0 && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 font-mono bg-red-500/10 border-red-500/30 text-red-400"
                        >
                          {c.bans} Bans
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CountryDetailSheet iso2={selectedIso2} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
};

export default GeoAttackMap;
