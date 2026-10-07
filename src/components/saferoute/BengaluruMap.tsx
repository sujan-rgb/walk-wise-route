import { useEffect, useRef, useState } from "react";
import { HELP_POINTS, ROUTES, ROUTE_KEYS, pointAt, type Report, type RouteKey } from "@/lib/saferoute";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { __srMapsReady?: () => void; google?: any } }

/** Projects the prototype's 600x380 sample grid onto central Bengaluru (Cubbon Park → MG Road area). */
export const toLatLng = ([x, y]: [number, number]) => ({ lat: 12.985 - (y / 380) * 0.015, lng: 77.59 + (x / 600) * 0.02 });

let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    window.__srMapsReady = () => resolve();
    const env = import.meta.env as Record<string, string | undefined>;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"]}&loading=async&callback=__srMapsReady&channel=${env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"]}`;
    s.async = true; s.onerror = () => { loader = null; reject(new Error("Map failed to load")); };
    document.head.appendChild(s);
  });
  return loader;
}

const css = (v: string, fb: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

export function BengaluruMap({ t, sel, lay, reps, walk, onSelect }: {
  t: number; sel: RouteKey; lay: { l: boolean; h: boolean; r: boolean }; reps: Report[];
  walk: { k: RouteKey; p: number } | null; onSelect: (k: RouteKey) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const walker = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    loadMaps().then(() => {
      if (!alive || !el.current) return;
      const g = window.google.maps;
      map.current = new g.Map(el.current, {
        center: toLatLng([300, 190]), zoom: 15, clickableIcons: false, mapTypeControl: false, streetViewControl: false,
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
      });
      setReady(true);
    }).catch(() => alive && setErr("The Bengaluru map couldn't load. Check your connection and refresh."));
    return () => { alive = false; };
  }, []);

  // Routes, lamps, help points, reports
  useEffect(() => {
    if (!ready) return;
    const g = window.google.maps, m = map.current;
    overlays.current.forEach((o) => o.setMap(null)); overlays.current = [];
    const add = (o: any) => overlays.current.push(o);
    const colors: Record<RouteKey, string> = { fast: "#6b7a88", bal: "#5a4fcf", safe: "#0b7f81" };
    ROUTE_KEYS.forEach((k) => {
      const line = new g.Polyline({ map: m, path: ROUTES[k].p.map(toLatLng), strokeColor: colors[k], strokeWeight: k === sel ? 8 : 5, strokeOpacity: k === sel ? 1 : 0.45, zIndex: k === sel ? 3 : 1 });
      line.addListener("click", () => onSelect(k)); add(line);
      if (lay.l) {
        const n = Math.round((ROUTES[k].f.l[t] ?? 0) / 14);
        for (let i = 1; i <= n; i++) add(new g.Circle({ map: m, center: toLatLng(pointAt(ROUTES[k].p, i / (n + 1))), radius: 14, fillColor: "#f2b84b", fillOpacity: 0.95, strokeWeight: 0, zIndex: 4 }));
      }
    });
    if (lay.h) HELP_POINTS.forEach(([x, y, name]) => add(new g.Marker({ map: m, position: toLatLng([x, y]), title: name, label: { text: "+", color: "#fff", fontWeight: "800" },
      icon: { path: g.SymbolPath.CIRCLE, scale: 10, fillColor: "#2f6fed", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } })));
    if (lay.r) reps.filter((x) => x.st === "verified").forEach((x, i) => add(new g.Marker({ map: m, position: toLatLng(pointAt(ROUTES[x.a].p, 0.35 + 0.1 * (i % 4))), title: `${x.cat}: ${x.txt}`,
      label: { text: "!", color: "#fff", fontWeight: "800" }, icon: { path: g.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 7, fillColor: "#ef4444", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 } })));
    add(new g.Marker({ map: m, position: toLatLng([50, 320]), title: "State Central Library, Cubbon Park", label: { text: "Central Library", fontWeight: "700" } }));
    add(new g.Marker({ map: m, position: toLatLng([550, 60]), title: "Hostel Block C", label: { text: "Hostel Block C", fontWeight: "700" } }));
  }, [ready, t, sel, lay, reps, onSelect]);

  // Live Safe Walk position
  useEffect(() => {
    if (!ready) return;
    const g = window.google.maps;
    if (!walk) { walker.current?.setMap(null); walker.current = null; return; }
    const pos = toLatLng(pointAt(ROUTES[walk.k].p, walk.p));
    if (!walker.current) walker.current = new g.Marker({ map: map.current, zIndex: 10, title: "You", icon: { path: g.SymbolPath.CIRCLE, scale: 9, fillColor: css("--sr-lp", "#f2b84b"), fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 } });
    walker.current.setPosition(pos);
  }, [ready, walk]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={el} role="region" aria-label="Map of central Bengaluru with three route options" style={{ width: "100%", aspectRatio: "600 / 380", borderRadius: 10, background: "var(--sr-map)" }} />
      {!ready && <p className="mu" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", margin: 0 }}>{err || "Loading Bengaluru map…"}</p>}
    </div>
  );
}
