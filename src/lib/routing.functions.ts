import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const place = z.string().trim().min(2).max(160);

function decode(s: string): [number, number][] {
  let i = 0, lat = 0, lng = 0; const out: [number, number][] = [];
  while (i < s.length) {
    for (let k = 0; k < 2; k++) {
      let sh = 0, r = 0, b: number;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
      const d = r & 1 ? ~(r >> 1) : r >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

const waypoint = (v: string) => {
  const m = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? { location: { latLng: { latitude: +m[1]!, longitude: +m[2]! } } } : { address: v };
};

type ApiRoute = { distanceMeters?: number; description?: string; polyline?: { encodedPolyline?: string } };

async function compute(body: object, key: string, conn: string): Promise<ApiRoute[]> {
  const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": conn, "Content-Type": "application/json", "X-Goog-FieldMask": "routes.distanceMeters,routes.description,routes.polyline.encodedPolyline" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`Routes failed [${res.status}]: ${await res.text()}`); throw new Error("Route lookup failed"); }
  return ((await res.json()) as { routes?: ApiRoute[] }).routes ?? [];
}

export const planTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: place, to: place }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"], conn = process.env["GOOGLE_MAPS_API_KEY"];
    if (!key || !conn) return { error: "Maps is not configured.", routes: [] };
    const base = { origin: waypoint(data.from), destination: waypoint(data.to), travelMode: "WALK", regionCode: "IN", languageCode: "en" };
    try {
      let routes = await compute({ ...base, computeAlternativeRoutes: true }, key, conn);
      const first = routes[0]?.polyline?.encodedPolyline;
      if (!first) return { error: "No walking route found between those places. Try more specific names.", routes: [] };
      // Fewer than 3 options: add detours via points offset either side of the direct path's midpoint.
      if (routes.length < 3) {
        const pts = decode(first), a = pts[0]!, b = pts[pts.length - 1]!, mid = pts[Math.floor(pts.length / 2)]!;
        const dx = b[1] - a[1], dy = b[0] - a[0], len = Math.hypot(dx, dy) || 1, off = Math.max(0.004, len * 0.25);
        const extra = await Promise.all([1, -1].map((sgn) => compute({ ...base, intermediates: [{ location: { latLng: { latitude: mid[0] + (dx / len) * off * sgn, longitude: mid[1] - (dy / len) * off * sgn } } }] }, key, conn).catch(() => [])));
        routes = [...routes, ...extra.flat()].slice(0, 3);
      }
      return {
        error: null,
        routes: routes.filter((r) => r.polyline?.encodedPolyline).map((r, i) => ({
          p: decode(r.polyline!.encodedPolyline!), km: Math.round((r.distanceMeters ?? 0) / 100) / 10, a: r.description || ["Main route", "North detour", "South detour"][i] || "Route",
        })),
      };
    } catch {
      return { error: "Couldn't find routes right now. Please try again.", routes: [] };
    }
  });
