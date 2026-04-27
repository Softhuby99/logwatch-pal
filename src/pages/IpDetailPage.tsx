import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import IpDetailView from "@/components/dashboard/IpDetailView";
import { useParams } from "react-router-dom";

const IpDetailPage = () => {
  const { ip = "" } = useParams<{ ip: string }>();
  const decoded = decodeURIComponent(ip);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Zurück zum Dashboard</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-mono text-foreground">IP: {decoded}</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <IpDetailView ip={decoded} embedded={false} />
      </main>
    </div>
  );
};

export default IpDetailPage;
