import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadMaps } from "@/components/saferoute/BengaluruMap";

export const Route = createFileRoute("/live/$id")({
  head: () => ({
    meta: [
      { title: "Live location — SafeRoute SOS" },
      { name: "description", content: "Live location shared by a SafeRoute user during an SOS alert." },
      { property: "og:title", content: "Live location — SafeRoute SOS" },
      { property: "og:description", content: "Follow the live location shared during a SafeRoute SOS alert." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LivePage,
});

type Share = { lat: number | null; lng: number | null; acc: number | null; updated_at: string; live: boolean; name: string | null };

function LivePage() {
  const { id } = Route.useParams();
  const [s, setS] = useState<Share | null>(null);
  const [missing, setMissing] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const pin = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_live_share", { _id: id });
      if (!alive) return;
      const row = (data as Share[] | null)?.[0];
      if (row) setS(row); else setMissing(true);
    };
    load();
    const iv = setInterval(load, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, [id]);

  useEffect(() => {
    if (!s?.lat || !s.lng) return;
    const pos = { lat: s.lat, lng: s.lng };
    loadMaps().then(() => {
      const g = window.google.maps;
      if (!map.current && el.current) map.current = new g.Map(el.current, { center: pos, zoom: 17, streetViewControl: false, mapTypeControl: false });
      if (!pin.current) pin.current = new g.Marker({ map: map.current, title: "Live location" });
      pin.current.setPosition(pos); map.current?.panTo(pos);
    }).catch(() => {});
  }, [s?.lat, s?.lng]);

  const who = s?.name || "Your contact";
  return (
    <div className="sr" style={{ minHeight: "100vh" }}>
      <main style={{ maxWidth: 720, margin: "auto", padding: 16 }}>
        <h1>SafeRoute SOS — live location</h1>
        {missing ? <p className="note">This live location link has expired or doesn't exist.</p> : !s ? <p className="mu">Loading…</p> : (<>
          <div className="note" role="alert">
            <b>{who} {s.live ? "triggered an SOS and is sharing their live location." : "has stopped sharing their location."}</b><br />
            {s.lat != null && s.lng != null ? <>Coordinates: <b>{s.lat.toFixed(6)}, {s.lng.toFixed(6)}</b>{s.acc ? ` (±${s.acc} m)` : ""}<br /></> : "Waiting for the first location fix…"}
            Last updated: {new Date(s.updated_at).toLocaleString()}
          </div>
          <div ref={el} style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 10, background: "var(--sr-map)", margin: "12px 0" }} />
          <div className="row">
            {s.lat != null && s.lng != null && <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">Get directions</a>}
            <a className="btn d" href="tel:112">Call 112</a><a className="btn o" href="tel:100">Police 100</a>
          </div>
          <p className="mu">This page refreshes every 5 seconds. Sharing ends automatically when the SOS ends or after 2 hours.</p>
        </>)}
      </main>
    </div>
  );
}
