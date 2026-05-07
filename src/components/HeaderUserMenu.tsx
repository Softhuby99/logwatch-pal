import { useState } from "react";
import { Activity, Info, LogOut, RefreshCw, Settings2, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useApiLive } from "@/contexts/ApiLiveContext";
import { useRefreshSettings } from "@/contexts/RefreshSettingsContext";
import { ToolsDialog } from "@/components/ToolsDialog";
import { InfoDialog } from "@/components/InfoDialog";

const initialsOf = (name: string) =>
  name
    .split(/\s+|@|\./)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

export const HeaderUserMenu = () => {
  const { user, logout } = useAuth();
  const { live } = useApiLive();
  const { triggerRefresh, refreshMs } = useRefreshSettings();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    triggerRefresh();
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 700);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Manual refresh */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title={`Jetzt aktualisieren (Auto: ${Math.round(refreshMs / 1000)}s)`}
        onClick={handleRefresh}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
      </Button>

      {/* Live / Demo Indicator */}
      {live ? (
        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
          <Activity className="h-3 w-3 animate-pulse" />
          LIVE
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
          DEMO
        </Badge>
      )}

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50 transition-colors outline-none">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                {initialsOf(user.name || user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[140px] truncate">
              {user.email || user.name}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {user.kind === "oidc" ? "SSO Session" : "Demo Session"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserIcon className="mr-2 h-4 w-4" />
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setToolsOpen(true)} className="cursor-pointer">
              <Settings2 className="mr-2 h-4 w-4" />
              Tools &amp; Einstellungen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setInfoOpen(true)} className="cursor-pointer">
              <Info className="mr-2 h-4 w-4" />
              Info &amp; Glossar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <ToolsDialog open={toolsOpen} onOpenChange={setToolsOpen} />
      <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
};

export default HeaderUserMenu;
