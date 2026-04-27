import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import IpDetailSheet from "@/components/dashboard/IpDetailSheet";

interface IpDetailCtx {
  openIp: (ip: string) => void;
  closeIp: () => void;
}

const Ctx = createContext<IpDetailCtx | null>(null);

export const IpDetailProvider = ({ children }: { children: ReactNode }) => {
  const [ip, setIp] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const openIp = useCallback((newIp: string) => {
    setIp(newIp);
    setOpen(true);
  }, []);

  const closeIp = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith("/ip/")) {
      setOpen(false);
    }
  }, [location.pathname]);

  return (
    <Ctx.Provider value={{ openIp, closeIp }}>
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
      closeIp: () => undefined,
    };
  }
  return ctx;
};
