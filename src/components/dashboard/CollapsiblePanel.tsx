import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface CollapsiblePanelProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsiblePanel = ({ title, defaultOpen = true, children }: CollapsiblePanelProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [open]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span className="font-medium tracking-wide uppercase">{title}</span>
        {open && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
            {format(now, "yyyy-MM-dd HH:mm:ss")}
          </span>
        )}
      </button>
      {open && children}
    </div>
  );
};

export default CollapsiblePanel;
