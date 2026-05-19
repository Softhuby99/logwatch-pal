import { Shield } from "lucide-react";
import StatsCards from "@/components/dashboard/StatsCards";
import AuthTimeline from "@/components/dashboard/AuthTimeline";
import TopAttackers from "@/components/dashboard/TopAttackers";
import CrowdSecAlerts from "@/components/dashboard/CrowdSecAlerts";
import EventFeed from "@/components/dashboard/EventFeed";
import SourceBreakdown from "@/components/dashboard/SourceBreakdown";
import AttackTimelineChart from "@/components/dashboard/AttackTimelineChart";
import TopAttackersTabbed from "@/components/dashboard/TopAttackersTabbed";
import IPStats7Days from "@/components/dashboard/IPStats7Days";
import AggressiveIPs30Days from "@/components/dashboard/AggressiveIPs30Days";
import InternalAuthProblems from "@/components/dashboard/InternalAuthProblems";
import GeoAttackMap from "@/components/dashboard/GeoAttackMap";
import CollapsiblePanel from "@/components/dashboard/CollapsiblePanel";
import HeaderUserMenu from "@/components/HeaderUserMenu";

const Index = () => (
  <div className="min-h-screen bg-background text-foreground">
    {/* Header */}
    <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">LogCollector SOC</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Collector v2.9.3 • Mailcow + CrowdSec
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-tight">
              Dashboard v0.6
            </p>
          </div>
        </div>
        <HeaderUserMenu />
      </div>
    </header>

    {/* Dashboard */}
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <StatsCards />

      <CollapsiblePanel title="Attack Timeline">
        <AttackTimelineChart />
      </CollapsiblePanel>

      <CollapsiblePanel title="GeoIP · Angriffsherkunft (Weltkarte)">
        <GeoAttackMap />
      </CollapsiblePanel>

      <CollapsiblePanel title="Top Angreifer · 24h / 7T / 30T">
        <TopAttackersTabbed />
      </CollapsiblePanel>

      <CollapsiblePanel title="Auth Timeline & Quellen">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AuthTimeline />
          </div>
          <SourceBreakdown />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Top Angreifer & CrowdSec">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopAttackers />
          <CrowdSecAlerts />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="IP Statistik 7 Tage">
        <IPStats7Days />
      </CollapsiblePanel>

      <CollapsiblePanel title="Aggressive IPs 30 Tage">
        <AggressiveIPs30Days />
      </CollapsiblePanel>

      <CollapsiblePanel title="Interne Auth-Probleme 30 Tage">
        <InternalAuthProblems />
      </CollapsiblePanel>

      <CollapsiblePanel title="Event Feed">
        <EventFeed />
      </CollapsiblePanel>
    </main>
  </div>
);

export default Index;
