// Mock attack timeline data – hourly buckets over 7 days
export interface AttackTimelineEntry {
  time: string;
  brute_force: number;
  port_scan: number;
  auth_failure: number;
  ban: number;
  crawl_probe: number;
}

const generateTimeline = (): AttackTimelineEntry[] => {
  const data: AttackTimelineEntry[] = [];
  const now = new Date();
  // 7 days, 4h buckets = 42 points
  for (let i = 41; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
    const hour = t.getHours();
    const nightFactor = hour >= 1 && hour <= 6 ? 2.2 : 1;
    data.push({
      time: t.toISOString(),
      brute_force: Math.round((Math.random() * 12 + 3) * nightFactor),
      port_scan: Math.round((Math.random() * 8 + 1) * nightFactor * 0.7),
      auth_failure: Math.round((Math.random() * 18 + 5) * nightFactor),
      ban: Math.round(Math.random() * 6 + 1),
      crawl_probe: Math.round(Math.random() * 5 + 1),
    });
  }
  return data;
};

export const mockAttackTimeline = generateTimeline();
