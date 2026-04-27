import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import IpDetailSheet from "@/components/dashboard/IpDetailSheet";

interface IpDetailCtx {
  openIp: (ip: string) => void;
}

const Ctx = createContext<IpDetailCtx | null>(null);

export const IpDetailProvider = ({ children }: { children: ReactNode }) => {
  const [ip, setIp] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const openIp = useCallback((newIp: string) => {
    setIp(newIp);
    setOpen(true);
  }, []);

  return (
    <Ctx.Provider value={{ openIp }}>
      {children}
      <IpDetailSheet ip={ip} open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
};

export const useIpDetail = (): IpDetailCtx => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback: navigate to /ip/:ip statt Sheet, falls Provider fehlt
    return {
      openIp: (ip: string) => {
        window.location.href = `/ip/${encodeURIComponent(ip)}`;
      },
    };
  }
  return ctx;
};
