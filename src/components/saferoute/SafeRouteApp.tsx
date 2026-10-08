import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BengaluruMap } from "./BengaluruMap";
import { useServerFn } from "@tanstack/react-start";
import { planTrip } from "@/lib/routing.functions";
import { useContacts, useIsModerator, useReports, useSession } from "./useLiveData";
import {
  CATEGORIES, TRIP, applyRoutes, ROUTES, ROUTE_KEYS, SPEEDS, TIMES, minutes, sanitize, score,
  type Category, type Mode, type Report, type RouteKey,
} from "@/lib/saferoute";

type Tab = "plan" | "walk" | "sos" | "rep" | "ins" | "about";
const TABS: [Tab, string][] = [["plan", "Plan route"], ["walk", "Safe Walk"], ["sos", "SOS"], ["rep", "Report"], ["ins", "Campus insights"], ["about", "About"]];
const stamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function SafeRouteApp() {
  const [tab, setTab] = useState<Tab>("plan");
  const [dark, setDark] = useState(false);
  const [t, setT] = useState(2);
  const [mode, setMode] = useState<Mode>("Walking");
  const [sel, setSel] = useState<RouteKey>("safe");
  const [lay, setLay] = useState({ l: true, h: true, r: true });
  const { user } = useSession();
  const isMod = useIsModerator(user);
  const live = useReports(user);
  const reps = live.reps;
  const cts = useContacts(user);
  const [dur, setDur] = useState(60);
  const [walk, setWalk] = useState<{ k: RouteKey; p: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [geo, setGeo] = useState<{ lat: number; lng: number; acc: number; at: number } | null>(null);
  const [geoState, setGeoState] = useState<"off" | "asking" | "live" | "denied" | "unsupported">("off");
  const watchId = useRef<number | null>(null);
  const [sos, setSos] = useState<null | { n: number } | { sent: true }>(null);
  const [log, setLog] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [ver, setVer] = useState(0);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const picked = cts.contacts.filter((c) => c.selected);
  const contacts = picked.map((c) => c.name);
  const note = (m: string) => setLog((l) => [`${stamp()} · ${m}`, ...l]);

  useEffect(() => { setDark(window.matchMedia("(prefers-color-scheme: dark)").matches); }, []);

  // Safe Walk progress
  const walking = walk !== null && walk.p < 1;
  useEffect(() => {
    if (!walking) return;
    const iv = setInterval(() => setWalk((w) => {
      if (!w) return w;
      const p = Math.min(1, w.p + 0.025);
      if (p >= 1) note("Reached destination. Waiting for you to confirm arrival.");
      return { ...w, p };
    }), 1000);
    return () => clearInterval(iv);
  }, [walking]);

  const clearGeo = () => {
    if (watchId.current !== null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null; setGeo(null); setGeoState("off");
  };
  const startWalk = () => {
    if (!contacts.length) return setMsg("Pick at least one trusted contact first.");
    if (!consent) return setMsg("Please confirm consent before sharing your location.");
    setMsg(""); setWalk({ k: sel, p: 0 }); setExpiresAt(Date.now() + dur * 60_000); setNow(Date.now());
    note(`Sharing live location with ${contacts.join(", ")} on the ${ROUTES[sel].n} route. Session expires in ${dur} min.`);
    if (!("geolocation" in navigator)) { setGeoState("unsupported"); return; }
    setGeoState("asking");
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => { setGeoState("live"); setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy), at: Date.now() }); },
      () => { setGeoState("denied"); note("Device location unavailable — using simulated route position."); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };
  const stopWalk = (m: string) => { clearGeo(); setWalk(null); setExpiresAt(null); setConsent(false); note(m); };

  // Session clock: tick every second and auto-expire
  useEffect(() => {
    if (!expiresAt) return;
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  useEffect(() => {
    if (expiresAt && now >= expiresAt) stopWalk("Session expired. Sharing stopped automatically and location discarded.");
  }, [now, expiresAt]);
  useEffect(() => () => clearGeo(), []);
  const remaining = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const mmss = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;

  // SOS countdown
  const counting = sos !== null && "n" in sos;
  useEffect(() => {
    if (!counting) return;
    const iv = setInterval(() => setSos((s) => {
      if (!s || !("n" in s)) return s;
      if (s.n <= 1) { note(`SOS sent to ${[...contacts, "campus security"].join(", ")} with live location link.`); return { sent: true }; }
      return { n: s.n - 1 };
    }), 1000);
    return () => clearInterval(iv);
  }, [counting]);

  const go = (k: Tab) => { setTab(k); setMsg(""); };

  return (
    <div className={`sr ${dark ? "sr-dark" : ""}`}>
      <header>
        <div><h1>SafeRoute</h1><p>The safest path, not just the shortest path. Sample campus data.</p></div>
        <div className="row" style={{ margin: 0 }}>
          {user ? (<><span className="mu" style={{ alignSelf: "center" }}>{user.email}{isMod ? " · moderator" : ""}</span><button className="chip" onClick={() => supabase.auth.signOut()}>Sign out</button></>)
            : <Link to="/auth" className="chip">Sign in</Link>}
          <button className="chip" onClick={() => setDark((d) => !d)} aria-label="Toggle dark mode">{dark ? "Light" : "Dark"} mode</button>
        </div>
      </header>
      <nav aria-label="Sections">
        {TABS.map(([k, l]) => <button key={k} className={k === tab ? "on" : ""} aria-current={k === tab} onClick={() => go(k)}>{l}</button>)}
      </nav>
      <main>
        {tab === "plan" && <Plan {...{ t, setT, mode, setMode, sel, setSel, lay, setLay, reps, walk, ver, signedIn: !!user }} onPlanned={() => setVer((v) => v + 1)} onWalk={() => go("walk")} />}
        {tab === "walk" && (
          <div className="g">
            <div className="pn">
              <h2>Safe Walk Mode</h2>
              <p className="mu">Tracking is opt-in, time-limited and easy to stop. Only the contacts you choose can see your journey.</p>
              <h3>Trusted contacts</h3>
              {!user ? <p className="mu"><Link to="/auth">Sign in</Link> to manage your trusted contacts.</p> : <ContactsEditor cts={cts} locked={!!walk} />}
              <h3>Sharing time limit</h3>
              <select value={dur} disabled={!!walk} onChange={(e) => setDur(+e.target.value)} aria-label="Sharing time limit">
                {[30, 60, 90].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
              {msg && <p className="note">{msg}</p>}
              {walk && (
                <div className="live" role="status" aria-live="polite">
                  <div className="live-top"><span className="dot" /> <b>Sharing live</b><span className="mu">Expires in <b className="clock">{mmss}</b></span></div>
                  <div className="bar"><i style={{ width: `${(remaining / (dur * 60_000)) * 100}%`, background: "var(--sr-wn)" }} /></div>
                  <p className="mu" style={{ margin: "6px 0" }}>
                    {geoState === "live" && geo ? `Device location: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} (±${geo.acc} m) · updated ${Math.max(0, Math.round((now - geo.at) / 1000))}s ago`
                      : geoState === "asking" ? "Waiting for your browser's location permission…"
                      : geoState === "denied" ? "Location permission denied — showing simulated position on the map."
                      : geoState === "unsupported" ? "This device can't share location — showing simulated position." : ""}
                  </p>
                  <button className="btn d stop" onClick={() => stopWalk("You stopped sharing. Location is no longer visible and has been discarded.")}>Stop sharing now</button>
                </div>
              )}
              {!walk && (
                <label className="c consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>I agree to share my live location with the selected contacts for up to {dur} minutes. Sharing ends automatically, and I can stop it at any time. Location is never stored after the session.</span></label>
              )}
              {walk ? (<>
                <h3>Journey in progress ({ROUTES[walk.k].n} route) · {Math.round(walk.p * 100)}%</h3>
                <div className="bar" role="progressbar" aria-valuenow={Math.round(walk.p * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${walk.p * 100}%` }} /></div>
                <div className="row">
                  <button className="btn o" onClick={() => note("You checked in: all good.")}>Check in: I'm okay</button>
                  <button className="btn" onClick={() => stopWalk("Arrived safely. Contacts notified and sharing stopped.")}>Arrived safely</button>
                  <button className="btn o" onClick={() => note("Missed check-in. Contacts asked to call you; SOS suggested.")}>Simulate missed check-in</button>
                </div>
                <DistressLinks contacts={picked} where={geo} />
              </>) : <div className="row"><button className="btn" disabled={!consent} style={{ opacity: consent ? 1 : 0.5 }} onClick={startWalk}>Start Safe Walk on {ROUTES[sel].n} route</button></div>}
              <p className="mu">Privacy: location is shared only during this walk and is discarded when sharing stops.</p>
            </div>
            <div className="pn"><h2>What your contacts see</h2>
              {log.length ? <ul className="log" aria-live="polite">{log.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="mu">Nothing yet. Start a Safe Walk to send the first update.</p>}
            </div>
          </div>
        )}
        {tab === "sos" && (
          <div className="pn" style={{ maxWidth: 560, margin: "auto", textAlign: "center" }}>
            <h2>SOS support</h2>
            <p className="mu">Sends an alert and live location to your chosen contacts ({contacts.join(", ") || "none selected"}) and campus security.</p>
            {!sos ? (<><button className="sos" onClick={() => { setSos({ n: 5 }); navigator.geolocation?.getCurrentPosition((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}); }}>SOS</button><p className="mu">A 5-second countdown lets you cancel accidental taps.</p></>)
              : "sent" in sos ? (<>
                <div className="note" style={{ textAlign: "left" }} role="alert"><b>Alert sent.</b> Contacts and campus security can see your live location.<br />If you are in danger, call your local emergency number now (112 in India). Move toward the nearest lit, staffed place or help point.</div>
                <a className="btn d call112" href="tel:112">Call 112 now (emergency)</a>
                <DistressLinks contacts={picked} where={here ?? geo} />
                <button className="btn o" onClick={() => { setSos(null); note("SOS ended. Location sharing stopped."); }}>Stop sharing and end SOS</button>
              </>) : (<>
                <button className="sos" disabled aria-live="assertive">{sos.n}</button>
                <button className="btn o" onClick={() => setSos(null)}>Cancel alert</button>
              </>)}
          </div>
        )}
        {tab === "rep" && <Reports reps={reps} live={live} signedIn={!!user} isMod={isMod} msg={msg} setMsg={setMsg} />}
        {tab === "ins" && <Insights reps={reps} />}
        {tab === "about" && <About />}
      </main>
    </div>
  );
}

function Plan(p: {
  t: number; setT: (n: number) => void; mode: Mode; setMode: (m: Mode) => void; sel: RouteKey; setSel: (k: RouteKey) => void;
  lay: { l: boolean; h: boolean; r: boolean }; setLay: (l: { l: boolean; h: boolean; r: boolean }) => void; reps: Report[]; walk: { k: RouteKey; p: number } | null; onWalk: () => void;
  ver: number; signedIn: boolean; onPlanned: () => void;
}) {
  const q = score(p.sel, p.t, p.reps);
  const weak = q.P.reduce((a, b) => (b[1] < a[1] ? b : a));
  const layers: ["l" | "h" | "r", string][] = [["l", "Lighting"], ["h", "Help points"], ["r", "Verified reports"]];
  return (
    <>
    <TripBar signedIn={p.signedIn} onPlanned={p.onPlanned} />
    <div className="g">
      <div className="pn">
        <BengaluruMap t={p.t} sel={p.sel} lay={p.lay} reps={p.reps} walk={p.walk} onSelect={p.setSel} ver={p.ver} />
        <div className="row">{layers.map(([k, l]) => <label key={k} className="c"><input type="checkbox" checked={p.lay[k]} onChange={(e) => p.setLay({ ...p.lay, [k]: e.target.checked })} />{l}</label>)}</div>
      </div>
      <div className="pn">
        <h2>{TRIP.from.split(",")[0]} to {TRIP.to.split(",")[0]}</h2>
        <p className="mu" style={{ marginTop: -6 }}>Tap a route line on the map to select it</p>
        <div className="row" role="group" aria-label="Travel mode">{(Object.keys(SPEEDS) as Mode[]).map((m) => <button key={m} className={`chip ${m === p.mode ? "on" : ""}`} aria-pressed={m === p.mode} onClick={() => p.setMode(m)}>{m}</button>)}</div>
        <div className="row" role="group" aria-label="Time of day">{TIMES.map((x, i) => <button key={x} className={`chip ${i === p.t ? "on" : ""}`} aria-pressed={i === p.t} onClick={() => p.setT(i)}>{x}</button>)}</div>
        {ROUTE_KEYS.map((k) => (
          <button key={k} className={`rc ${k === p.sel ? "on" : ""}`} style={{ ["--c" as string]: ROUTES[k].c }} aria-pressed={k === p.sel} onClick={() => p.setSel(k)}>
            <b>{ROUTES[k].n}</b><span className="sc">{score(k, p.t, p.reps).s}</span><span className="mu">{ROUTES[k].km} km · {minutes(k, p.mode)} min via {ROUTES[k].a}</span>
          </button>
        ))}
        <h3>Why the {ROUTES[p.sel].n} route scores {q.s}/100</h3>
        {q.P.map(([n, v]) => <div key={n} className="fl"><span>{n}</span><div className="bar"><i style={{ width: `${v}%` }} /></div><b>{v}</b></div>)}
        <p className="mu">Weakest factor: {weak[0].toLowerCase()} ({weak[1]}).{q.v ? ` ${q.v} verified report${q.v > 1 ? "s" : ""} on ${ROUTES[p.sel].a} lower this score.` : ""} Weights shift toward lighting after dark.</p>
        <div className="note">This is a safety estimate from available data, never a guarantee. No route is labelled completely safe.</div>
        <button className="btn" onClick={p.onWalk}>Start Safe Walk on this route</button>
      </div>
    </div>
    </>
  );
}

function ContactsEditor({ cts, locked }: { cts: ReturnType<typeof useContacts>; locked: boolean }) {
  const [name, setName] = useState(""); const [rel, setRel] = useState(""); const [phone, setPhone] = useState(""); const [err, setErr] = useState("");
  return (<>
    {cts.contacts.map((c) => (
      <div key={c.id} className="row" style={{ margin: "2px 0", alignItems: "center" }}>
        <label className="c" style={{ flex: 1 }}><input type="checkbox" checked={c.selected} disabled={locked} onChange={() => cts.toggle(c)} />{c.name}{c.relation ? ` (${c.relation})` : ""}{c.phone ? <span className="mu">&nbsp;· {c.phone}</span> : null}</label>
        {!locked && <button className="chip" aria-label={`Remove ${c.name}`} onClick={() => cts.remove(c.id)}>Remove</button>}
      </div>
    ))}
    {!cts.contacts.length && <p className="mu">No contacts yet — add one below.</p>}
    {!locked && <form className="row" onSubmit={(e) => { e.preventDefault(); const n = sanitize(name).slice(0, 40); if (!n) return setErr("Add a name.");
      const ph = phone.trim(); if (ph && !/^\+?[0-9 ()-]{6,20}$/.test(ph)) return setErr("Phone: digits only, e.g. +91 98765 43210");
      cts.add(n, sanitize(rel).slice(0, 40), ph).then((e) => { setErr(e ?? ""); if (!e) { setName(""); setRel(""); setPhone(""); } }); }}>
      <input className="inp" style={{ flex: 2, margin: 0 }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Contact name" />
      <input className="inp" style={{ flex: 2, margin: 0 }} placeholder="Relation (optional)" value={rel} onChange={(e) => setRel(e.target.value)} maxLength={40} aria-label="Relation" />
      <input className="inp" style={{ flex: 2, margin: 0 }} type="tel" placeholder="Phone, e.g. +91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} aria-label="Phone number" />
      <button className="btn o">Add</button>
    </form>}
    {err && <p className="note">{err}</p>}
  </>);
}

function Reports({ reps, live, signedIn, isMod, msg, setMsg }: { reps: Report[]; live: ReturnType<typeof useReports>; signedIn: boolean; isMod: boolean; msg: string; setMsg: (s: string) => void }) {
  const [cat, setCat] = useState<Category>(CATEGORIES[0]);
  const [area, setArea] = useState<RouteKey>("fast");
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const left = live.left;
  const submit = async () => {
    const clean = sanitize(txt);
    if (!clean) return setMsg("Add a short description first.");
    if (left < 1) return setMsg("Rate limit reached. Try again in an hour.");
    setBusy(true); const err = await live.submit(cat, area, clean); setBusy(false);
    if (err) return setMsg(err);
    setTxt(""); setMsg("Report submitted for moderation. Everyone sees it instantly; it counts toward scores once verified.");
  };
  const setSt = async (id: string, st: "verified" | "rejected") => { const e = await live.moderate(id, st); if (e) setMsg(e); };
  return (
    <div className="g">
      <div className="pn">
        <h2>Report a concern</h2>
        <p className="mu">Reports are moderated before they affect route scores, and sync live across devices. {signedIn ? `Rate limit: ${left} of 3 reports left this hour.` : ""}</p>
        {!signedIn && <p className="note"><Link to="/auth">Sign in</Link> to submit a report.</p>}
        <label htmlFor="rc">Type</label>
        <select id="rc" value={cat} onChange={(e) => setCat(e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <label htmlFor="ra">Where</label>
        <select id="ra" value={area} onChange={(e) => setArea(e.target.value as RouteKey)}>{ROUTE_KEYS.map((k) => <option key={k} value={k}>{ROUTES[k].a}</option>)}</select>
        <label htmlFor="rt">Details</label>
        <textarea id="rt" rows={3} maxLength={140} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="What did you see?" />
        <span className="mu">{txt.length}/140</span>
        <div className="row"><button className="btn" disabled={!signedIn || busy} style={{ opacity: signedIn ? 1 : 0.5 }} onClick={submit}>{busy ? "Submitting…" : "Submit report"}</button></div>
        {msg && <p className="note" role="status">{msg}</p>}
      </div>
      <div className="pn">
        <h2>Moderation queue</h2>
        {reps.map((x) => (
          <div key={x.id} style={{ padding: "8px 0", borderTop: "1px solid var(--sr-ln)" }}>
            <span className={`st ${x.st}`}>{x.st}</span> <b>{x.cat}</b> on {ROUTES[x.a].a}<br /><span className="mu">{x.txt}</span>
            {x.st === "pending" && isMod && <div className="row"><button className="btn" onClick={() => setSt(x.id, "verified")}>Moderator: verify</button><button className="btn o" onClick={() => setSt(x.id, "rejected")}>Reject</button></div>}
          </div>
        ))}
        {!isMod && <p className="mu">Only moderators can verify or reject reports.</p>}
        <p className="mu">Verify a report, then open Plan route: that route's score drops and a red marker appears.</p>
      </div>
    </div>
  );
}

function Insights({ reps }: { reps: Report[] }) {
  const v = reps.filter((x) => x.st === "verified");
  const c: Record<string, number> = {};
  reps.filter((x) => x.st !== "rejected").forEach((x) => (c[x.cat] = (c[x.cat] || 0) + 1));
  const mx = Math.max(1, ...Object.values(c));
  const areas = ROUTE_KEYS.filter((k) => v.some((x) => x.a === k));
  return (
    <div className="g">
      <div className="pn">
        <h2>Campus insights (anonymized)</h2>
        <p className="mu">Reporter identities are never shown. Only category and area trends reach campus security and facilities.</p>
        {Object.keys(c).length ? Object.entries(c).map(([k, n]) => <div key={k} className="fl"><span>{k}</span><div className="bar"><i style={{ width: `${(n / mx) * 100}%` }} /></div><b>{n}</b></div>) : <p className="mu">No reports yet.</p>}
      </div>
      <div className="pn">
        <h2>Suggested actions</h2>
        {areas.length ? <ul>{areas.map((k) => {
          const rs = v.filter((x) => x.a === k), n = rs.length;
          const lights = rs.some((x) => x.cat === "Broken light"), patrol = rs.some((x) => x.cat === "Harassment concern");
          return <li key={k}>{lights ? "Repair lighting" : "Inspect path upkeep"}{patrol ? " and add evening patrols" : ""} on <b>{ROUTES[k].a}</b> ({n} verified report{n > 1 ? "s" : ""}).</li>;
        })}</ul> : <p className="mu">Verify a report to generate maintenance and patrol suggestions.</p>}
        <p className="mu">Used to plan lighting repairs, maintenance and patrol coverage.</p>
      </div>
    </div>
  );
}

function About() {
  const items: [string, React.ReactNode, boolean?][] = [
    ["Problem", <p>Students, women, night-shift workers and pedestrians can feel unsafe after dark or in unfamiliar areas. Standard maps optimize for time and distance, not lighting, active spaces, help points or verified reports.</p>, true],
    ["How it works", <ol><li>Choose a destination and travel mode.</li><li>Each route is scored using lighting, verified reports, nearby help points and time of day.</li><li>You see Fastest, Safest and Balanced options with plain explanations.</li><li>During the trip you can share location, check in, report an issue or trigger SOS.</li><li>Institutions use anonymized trends to improve lighting, maintenance and patrols.</li></ol>, true],
    ["Who it is for", <p>College students, women travelling alone, night-shift employees, new visitors, parents or guardians who receive consent-based safe-arrival notifications, and campus security teams.</p>],
    ["Safety, ethics and privacy", <p>Never label a route completely safe. Prevent misuse with report moderation, rate limits and verification. Protect location data with consent, minimal collection, clear retention rules and an immediate stop-sharing control.</p>, true],
  ];
  return (
    <div className="pn" style={{ maxWidth: 760, margin: "auto" }}>
      <h2>About SafeRoute</h2>
      {items.map(([title, body, open]) => <details key={title} open={open}><summary>{title}</summary>{body}</details>)}
      <div className="note">SafeRoute helps people choose a safer way home by combining route guidance, trusted contacts, verified campus information and privacy-first emergency support.</div>
      <p className="mu">All routes, lamps and scores are sample data for demonstration.</p>
    </div>
  );
}

function TripBar({ signedIn, onPlanned }: { signedIn: boolean; onPlanned: () => void }) {
  const plan = useServerFn(planTrip);
  const [from, setFrom] = useState(TRIP.from);
  const [to, setTo] = useState(TRIP.to);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const useMine = () => navigator.geolocation?.getCurrentPosition(
    (p) => setFrom(`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`),
    () => setErr("Couldn't get your location. Type a start place instead."),
  );
  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = sanitize(from), d = sanitize(to);
    if (f.length < 2 || d.length < 2) return setErr("Enter both a start and a destination.");
    if (!signedIn) return setErr("Sign in to search new routes.");
    setBusy(true); setErr("");
    try {
      const r = await plan({ data: { from: f, to: d } });
      if (r.error || !r.routes.length) return setErr(r.error ?? "No route found.");
      applyRoutes(r.routes, /^-?\d/.test(f) ? "My location" : f, d); onPlanned();
    } catch { setErr("Couldn't find routes right now. Please try again."); }
    finally { setBusy(false); }
  };
  return (
    <form className="pn tripbar" onSubmit={go} aria-label="Plan a trip">
      <div className="tb-field"><label htmlFor="from">Start</label>
        <div className="row" style={{ margin: 0, flexWrap: "nowrap" }}><input id="from" className="inp" style={{ margin: 0 }} value={from} onChange={(e) => setFrom(e.target.value)} maxLength={160} placeholder="e.g. MG Road Metro, Bengaluru" />
          <button type="button" className="chip" onClick={useMine} title="Use my current location">📍</button></div></div>
      <div className="tb-field"><label htmlFor="to">Destination</label><input id="to" className="inp" style={{ margin: 0 }} value={to} onChange={(e) => setTo(e.target.value)} maxLength={160} placeholder="e.g. Indiranagar 100ft Road" /></div>
      <button className="btn" disabled={busy} style={{ alignSelf: "end" }}>{busy ? "Finding routes…" : "Find safe routes"}</button>
      {err && <p className="note" style={{ gridColumn: "1 / -1", margin: 0 }}>{err}</p>}
    </form>
  );
}

/** Free distress actions using the phone's own dialer and SMS app — no paid calling service needed. */
function DistressLinks({ contacts, where }: { contacts: { id: string; name: string; phone: string | null }[]; where: { lat: number; lng: number } | null }) {
  const withPhone = contacts.filter((c) => c.phone);
  const link = where ? `https://maps.google.com/?q=${where.lat.toFixed(5)},${where.lng.toFixed(5)}` : "";
  const body = encodeURIComponent(`SafeRoute distress alert: I need help.${link ? ` My location: ${link}` : ""}`);
  return (
    <div className="distress">
      <h3>Call or message for help</h3>
      {!withPhone.length && <p className="mu">Add phone numbers to your selected trusted contacts to call them from here.</p>}
      {withPhone.map((c) => (
        <div key={c.id} className="row" style={{ alignItems: "center", margin: "4px 0" }}>
          <b style={{ flex: 1 }}>{c.name}</b>
          <a className="btn" href={`tel:${c.phone!.replace(/[^+0-9]/g, "")}`}>Call</a>
          <a className="btn o" href={`sms:${c.phone!.replace(/[^+0-9]/g, "")}?body=${body}`}>SMS location</a>
        </div>
      ))}
      <div className="row"><a className="btn d" href="tel:112">Emergency 112</a><a className="btn o" href="tel:1091">Women helpline 1091</a><a className="btn o" href="tel:100">Police 100</a></div>
    </div>
  );
}
