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
        className="w-full sm:max-w-none sm:w-[90vw] lg:w-[80vw] xl:w-[70vw] 2xl:w-[1400px] overflow-y-auto bg-background border-l border-border/50 p-4 sm:p-6"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-sm font-normal text-muted-foreground tracking-wide">
            IP Detail · Drilldown
          </SheetTitle>
        </SheetHeader>
        {ip && (
          <IpDetailErrorBoundary key={ip}>
            <IpDetailView ip={ip} embedded />
          </IpDetailErrorBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default IpDetailSheet;
