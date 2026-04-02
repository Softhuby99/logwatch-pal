import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsiblePanelProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsiblePanel = ({ title, defaultOpen = true, children }: CollapsiblePanelProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span className="font-medium tracking-wide uppercase">{title}</span>
      </button>
      {open && children}
    </div>
  );
};

export default CollapsiblePanel;
