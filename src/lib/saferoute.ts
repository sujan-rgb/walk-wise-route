export type RouteKey = "fast" | "bal" | "safe";
export type Mode = "Walking" | "Cycling" | "Campus ride";
export type ReportStatus = "pending" | "verified" | "rejected";
export const CATEGORIES = ["Broken light", "Unsafe path", "Harassment concern", "Hazard"] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Report { id: number; cat: Category; a: RouteKey; txt: string; st: ReportStatus }

export interface RouteDef {
  n: string; c: string; stroke: string; km: number; a: string;
  p: [number, number][];
  f: { l: number[]; a: number[]; h: number[]; r: number };
}

export const ROUTES: Record<RouteKey, RouteDef> = {
  fast: { n: "Fastest", c: "var(--sr-fs)", stroke: "var(--sr-m-fs)", km: 1.2, a: "Market lane", p: [[50, 320], [200, 240], [360, 150], [550, 60]], f: { l: [78, 52, 28], a: [70, 48, 22], h: [40, 40, 40], r: 62 } },
  bal: { n: "Balanced", c: "var(--sr-bl)", stroke: "var(--sr-m-bl)", km: 1.4, a: "Park road", p: [[50, 320], [130, 200], [330, 180], [450, 110], [550, 60]], f: { l: [85, 72, 58], a: [75, 65, 50], h: [60, 60, 60], r: 80 } },
  safe: { n: "Safest", c: "var(--sr-sf)", stroke: "var(--sr-m-sf)", km: 1.7, a: "Main avenue", p: [[50, 320], [70, 150], [210, 85], [420, 70], [550, 60]], f: { l: [92, 88, 84], a: [78, 74, 66], h: [82, 82, 82], r: 90 } },
};
export const ROUTE_KEYS = Object.keys(ROUTES) as RouteKey[];
/** Weights per time of day: [lighting, active places, help points, verified reports] */
export const WEIGHTS = [[0.15, 0.25, 0.25, 0.35], [0.3, 0.25, 0.2, 0.25], [0.4, 0.2, 0.2, 0.2]];
export const TIMES = ["Day · 2 pm", "Evening · 7 pm", "Night · 11 pm"];
export const SPEEDS: Record<Mode, number> = { Walking: 5, Cycling: 14, "Campus ride": 20 };
export const HELP_POINTS: [number, number, string][] = [[68, 215, "Security booth"], [215, 95, "Medical point"], [335, 185, "Security booth"], [410, 78, "Help desk"], [455, 118, "Security booth"]];
export const REPORT_LIMIT = 3;
export const REPORT_WINDOW_MS = 60 * 60 * 1000;
export const REPORT_PENALTY = 8;

export function score(k: RouteKey, t: number, reports: Report[]) {
  const f = ROUTES[k].f, w = WEIGHTS[t] ?? WEIGHTS[0]!;
  const v = reports.filter((x) => x.a === k && x.st === "verified").length;
  const P: [string, number][] = [
    ["Lighting", f.l[t] ?? 0], ["Active public places", f.a[t] ?? 0], ["Help points nearby", f.h[t] ?? 0],
    ["Verified reports", Math.max(0, f.r - REPORT_PENALTY * v)],
  ];
  return { s: Math.round(P.reduce((a, p, i) => a + p[1] * (w[i] ?? 0), 0)), P, v };
}

export const minutes = (k: RouteKey, m: Mode) => Math.max(1, Math.round((ROUTES[k].km / SPEEDS[m]) * 60));

/** Returns how many reports remain in the rolling window. */
export function reportsLeft(stamps: number[], now: number) {
  return Math.max(0, REPORT_LIMIT - stamps.filter((s) => now - s < REPORT_WINDOW_MS).length);
}

export const sanitize = (s: string) => s.replace(/[<>&"'`]/g, "").trim().slice(0, 140);

export function pointAt(pts: [number, number][], t: number): [number, number] {
  const p = pts as [number, number][];
  const at = (i: number) => p[i]!;
  const L: number[] = []; let T = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(at(i)[0] - at(i - 1)[0], at(i)[1] - at(i - 1)[1]); L.push(d); T += d; }
  let x = t * T;
  for (let i = 0; i < L.length; i++) {
    const li = L[i]!;
    if (x <= li || i === L.length - 1) { const u = Math.min(1, x / li); return [at(i)[0] + (at(i + 1)[0] - at(i)[0]) * u, at(i)[1] + (at(i + 1)[1] - at(i)[1]) * u]; }
    x -= li;
  }
  return at(p.length - 1);
}
