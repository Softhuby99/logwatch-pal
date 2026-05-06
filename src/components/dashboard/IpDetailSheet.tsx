import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import IpDetailView from "./IpDetailView";
import IpDetailErrorBoundary from "./IpDetailErrorBoundary";

interface Props {
  ip: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IpDetailSheet = ({ ip, open, onOpenChange }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto bg-background border-l border-border/50 p-4 sm:p-6"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm font-normal text-muted-foreground tracking-wide">
            IP Detail · Drilldown
          </SheetTitle>
        </SheetHeader>
        {ip && <IpDetailView ip={ip} embedded />}
      </SheetContent>
    </Sheet>
  );
};

export default IpDetailSheet;
