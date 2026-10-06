import { useEffect, useRef, useState } from "react";
import {
  CATEGORIES, HELP_POINTS, ROUTES, ROUTE_KEYS, SPEEDS, TIMES, minutes, pointAt, reportsLeft, sanitize, score,
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
  const [con, setCon] = useState<Record<string, boolean>>({ Mom: true, Riya: true, Warden: false });
  const [dur, setDur] = useState(60);
  const [walk, setWalk] = useState<{ k: RouteKey; p: number } | null>(null);
  const [sos, setSos] = useState<null | { n: number } | { sent: true }>(null);
  const [log, setLog] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [stamps, setStamps] = useState<number[]>([]);
  const [reps, setReps] = useState<Report[]>([
    { id: 1, cat: "Broken light", a: "fast", txt: "Two lamps out near Market lane", st: "verified" },
    { id: 2, cat: "Unsafe path", a: "bal", txt: "Overgrown hedge blocks the view on Park road", st: "pending" },
  ]);
  const contacts = Object.keys(con).filter((k) => con[k]);
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

  // Auto-stop sharing after the chosen time limit
  const walkTimer = useRef<ReturnType<typeof setTimeout>>();
  const startWalk = () => {
    if (!contacts.length) return setMsg("Pick at least one trusted contact first.");
    setMsg(""); setWalk({ k: sel, p: 0 });
    note(`Sharing live location with ${contacts.join(", ")} on the ${ROUTES[sel].n} route. Auto-stops in ${dur} min.`);
    clearTimeout(walkTimer.current);
    walkTimer.current = setTimeout(() => stopWalk("Time limit reached. Sharing stopped automatically."), dur * 60_000);
  };
  const stopWalk = (m: string) => { clearTimeout(walkTimer.current); setWalk(null); note(m); };

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
        <button className="chip" onClick={() => setDark((d) => !d)} aria-label="Toggle dark mode">{dark ? "Light" : "Dark"} mode</button>
      </header>
      <nav aria-label="Sections">
        {TABS.map(([k, l]) => <button key={k} className={k === tab ? "on" : ""} aria-current={k === tab} onClick={() => go(k)}>{l}</button>)}
      </nav>
      <main>
        {tab === "plan" && <Plan {...{ t, setT, mode, setMode, sel, setSel, lay, setLay, reps, walk }} onWalk={() => go("walk")} />}
        {tab === "walk" && (
          <div className="g">
            <div className="pn">
              <h2>Safe Walk Mode</h2>
              <p className="mu">Tracking is opt-in, time-limited and easy to stop. Only the contacts you choose can see your journey.</p>
              <h3>Trusted contacts</h3>
              {Object.keys(con).map((k) => (
                <label key={k} className="c"><input type="checkbox" checked={con[k]} disabled={!!walk} onChange={(e) => setCon({ ...con, [k]: e.target.checked })} />{k}{k === "Warden" ? " (hostel warden)" : ""}</label>
              ))}
              <h3>Sharing time limit</h3>
              <select value={dur} disabled={!!walk} onChange={(e) => setDur(+e.target.value)} aria-label="Sharing time limit">
                {[30, 60, 90].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </select>
              {msg && <p className="note">{msg}</p>}
              {walk ? (<>
                <h3>Journey in progress ({ROUTES[walk.k].n} route) · {Math.round(walk.p * 100)}%</h3>
                <div className="bar" role="progressbar" aria-valuenow={Math.round(walk.p * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${walk.p * 100}%` }} /></div>
                <div className="row">
                  <button className="btn o" onClick={() => note("You checked in: all good.")}>Check in: I'm okay</button>
                  <button className="btn" onClick={() => stopWalk("Arrived safely. Contacts notified and sharing stopped.")}>Arrived safely</button>
                  <button className="btn o" onClick={() => note("Missed check-in. Contacts asked to call you; SOS suggested.")}>Simulate missed check-in</button>
                  <button className="btn d" onClick={() => stopWalk("You stopped sharing. Location is no longer visible.")}>Stop sharing now</button>
                </div>
              </>) : <div className="row"><button className="btn" onClick={startWalk}>Start Safe Walk on {ROUTES[sel].n} route</button></div>}
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
            {!sos ? (<><button className="sos" onClick={() => setSos({ n: 5 })}>SOS</button><p className="mu">A 5-second countdown lets you cancel accidental taps.</p></>)
              : "sent" in sos ? (<>
                <div className="note" style={{ textAlign: "left" }} role="alert"><b>Alert sent.</b> Contacts and campus security can see your live location.<br />If you are in danger, call your local emergency number now (112 in India). Move toward the nearest lit, staffed place or help point.</div>
                <button className="btn d" onClick={() => { setSos(null); note("SOS ended. Location sharing stopped."); }}>Stop sharing and end SOS</button>
              </>) : (<>
                <button className="sos" disabled aria-live="assertive">{sos.n}</button>
                <button className="btn o" onClick={() => setSos(null)}>Cancel alert</button>
              </>)}
          </div>
        )}
        {tab === "rep" && <Reports reps={reps} setReps={setReps} stamps={stamps} setStamps={setStamps} msg={msg} setMsg={setMsg} />}
        {tab === "ins" && <Insights reps={reps} />}
        {tab === "about" && <About />}
      </main>
    </div>
  );
}

function MapView({ t, sel, lay, reps, walk }: { t: number; sel: RouteKey; lay: { l: boolean; h: boolean; r: boolean }; reps: Report[]; walk: { k: RouteKey; p: number } | null }) {
  return (
    <svg viewBox="0 0 600 380" role="img" aria-label="Campus map with three route options">
      <rect width="600" height="380" fill="var(--sr-map)" />
      {[1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${i * 100} 0V380M0 ${i * 63}H600`} stroke="var(--sr-grid)" strokeWidth="2" />)}
      {ROUTE_KEYS.map((k) => <polyline key={k} points={ROUTES[k].p.join(" ")} fill="none" stroke={ROUTES[k].stroke} strokeWidth={k === sel ? 7 : 4} strokeLinecap="round" strokeLinejoin="round" opacity={k === sel ? 1 : 0.35} />)}
      {lay.l && ROUTE_KEYS.flatMap((k) => {
        const n = Math.round(ROUTES[k].f.l[t] / 14);
        return Array.from({ length: n }, (_, i) => { const q = pointAt(ROUTES[k].p, (i + 1) / (n + 1)); return <circle key={k + i} cx={q[0]} cy={q[1] - 9} r="3.5" fill="var(--sr-lp)" />; });
      })}
      {lay.h && HELP_POINTS.map(([x, y, n], i) => (
        <g key={i}><title>{n}</title><rect x={x - 8} y={y - 8} width="16" height="16" rx="3" fill="var(--sr-help)" /><path d={`M${x} ${y - 5}v10M${x - 5} ${y}h10`} stroke="var(--sr-on)" strokeWidth="2.5" /></g>
      ))}
      {lay.r && reps.filter((x) => x.st === "verified").map((x, i) => {
        const q = pointAt(ROUTES[x.a].p, 0.35 + 0.1 * (i % 4));
        return <g key={x.id}><title>{x.txt}</title><path d={`M${q[0]} ${q[1] + 14}l-11 -20h22z`} fill="var(--sr-alert)" /><text x={q[0]} y={q[1] + 11} fontSize="11" fill="var(--sr-on)" textAnchor="middle" fontWeight="800">!</text></g>;
      })}
      <circle cx="50" cy="320" r="9" fill="var(--sr-on)" /><text x="64" y="336" fill="var(--sr-on)" fontSize="13">Central Library</text>
      <circle cx="550" cy="60" r="9" fill="var(--sr-on)" /><text x="548" y="44" fill="var(--sr-on)" fontSize="13" textAnchor="end">Hostel Block C</text>
      {walk && (() => { const q = pointAt(ROUTES[walk.k].p, walk.p); return <circle cx={q[0]} cy={q[1]} r="9" fill="var(--sr-lp)" stroke="var(--sr-on)" strokeWidth="3" />; })()}
    </svg>
  );
}

function Plan(p: {
  t: number; setT: (n: number) => void; mode: Mode; setMode: (m: Mode) => void; sel: RouteKey; setSel: (k: RouteKey) => void;
  lay: { l: boolean; h: boolean; r: boolean }; setLay: (l: { l: boolean; h: boolean; r: boolean }) => void; reps: Report[]; walk: { k: RouteKey; p: number } | null; onWalk: () => void;
}) {
  const q = score(p.sel, p.t, p.reps);
  const weak = q.P.reduce((a, b) => (b[1] < a[1] ? b : a));
  const layers: ["l" | "h" | "r", string][] = [["l", "Lighting"], ["h", "Help points"], ["r", "Verified reports"]];
  return (
    <div className="g">
      <div className="pn">
        <MapView t={p.t} sel={p.sel} lay={p.lay} reps={p.reps} walk={p.walk} />
        <div className="row">{layers.map(([k, l]) => <label key={k} className="c"><input type="checkbox" checked={p.lay[k]} onChange={(e) => p.setLay({ ...p.lay, [k]: e.target.checked })} />{l}</label>)}</div>
      </div>
      <div className="pn">
        <h2>Central Library to Hostel Block C</h2>
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
  );
}

function Reports({ reps, setReps, stamps, setStamps, msg, setMsg }: { reps: Report[]; setReps: (f: (r: Report[]) => Report[]) => void; stamps: number[]; setStamps: (s: number[]) => void; msg: string; setMsg: (s: string) => void }) {
  const [cat, setCat] = useState<Category>(CATEGORIES[0]);
  const [area, setArea] = useState<RouteKey>("fast");
  const [txt, setTxt] = useState("");
  const left = reportsLeft(stamps, Date.now());
  const submit = () => {
    const clean = sanitize(txt);
    if (!clean) return setMsg("Add a short description first.");
    if (left < 1) return setMsg("Rate limit reached. Try again in an hour.");
    setStamps([...stamps, Date.now()]);
    setReps((r) => [...r, { id: Date.now(), cat, a: area, txt: clean, st: "pending" }]);
    setTxt(""); setMsg("Report submitted for moderation. It will count toward scores once verified.");
  };
  const setSt = (id: number, st: Report["st"]) => setReps((r) => r.map((x) => (x.id === id ? { ...x, st } : x)));
  return (
    <div className="g">
      <div className="pn">
        <h2>Report a concern</h2>
        <p className="mu">Reports are moderated before they affect route scores. Rate limit: {left} of 3 reports left this hour.</p>
        <label htmlFor="rc">Type</label>
        <select id="rc" value={cat} onChange={(e) => setCat(e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <label htmlFor="ra">Where</label>
        <select id="ra" value={area} onChange={(e) => setArea(e.target.value as RouteKey)}>{ROUTE_KEYS.map((k) => <option key={k} value={k}>{ROUTES[k].a}</option>)}</select>
        <label htmlFor="rt">Details</label>
        <textarea id="rt" rows={3} maxLength={140} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="What did you see?" />
        <span className="mu">{txt.length}/140</span>
        <div className="row"><button className="btn" onClick={submit}>Submit report</button></div>
        {msg && <p className="note" role="status">{msg}</p>}
      </div>
      <div className="pn">
        <h2>Moderation queue</h2>
        {reps.map((x) => (
          <div key={x.id} style={{ padding: "8px 0", borderTop: "1px solid var(--sr-ln)" }}>
            <span className={`st ${x.st}`}>{x.st}</span> <b>{x.cat}</b> on {ROUTES[x.a].a}<br /><span className="mu">{x.txt}</span>
            {x.st === "pending" && <div className="row"><button className="btn" onClick={() => setSt(x.id, "verified")}>Moderator: verify</button><button className="btn o" onClick={() => setSt(x.id, "rejected")}>Reject</button></div>}
          </div>
        ))}
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
