import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SafeRoute" },
      { name: "description", content: "Sign in to SafeRoute to report concerns, moderate and manage your trusted contacts." },
      { property: "og:title", content: "Sign in — SafeRoute" },
      { property: "og:description", content: "Sign in to report concerns and manage trusted contacts." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({ email: z.string().trim().email().max(255), password: z.string().min(8, "Password must be at least 8 characters").max(72) });

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse({ email, password });
    if (!p.success) return setMsg(p.error.issues[0]?.message ?? "Check your details.");
    setBusy(true); setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      setBusy(false);
      if (error) return setMsg(error.message);
      nav({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({ ...p.data, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    }
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return setMsg("Google sign-in failed. Please try again.");
    if (!r.redirected) nav({ to: "/" });
  };

  return (
    <div className="sr">
      <main style={{ maxWidth: 420, paddingTop: 60 }}>
        <div className="pn">
          <h1 style={{ fontSize: 26 }}>SafeRoute</h1>
          <p className="mu">{mode === "in" ? "Sign in to report, moderate and manage trusted contacts." : "Create an account."}</p>
          <button className="btn o" style={{ width: "100%", margin: "10px 0" }} onClick={google}>Continue with Google</button>
          <p className="mu" style={{ textAlign: "center" }}>or</p>
          <form onSubmit={submit}>
            <label htmlFor="em">Email</label>
            <input id="em" className="inp" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="pw">Password</label>
            <input id="pw" className="inp" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" style={{ width: "100%" }} disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
          </form>
          {msg && <p className="note" role="status">{msg}</p>}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="chip" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>{mode === "in" ? "New here? Create account" : "Have an account? Sign in"}</button>
            <button className="chip" onClick={() => nav({ to: "/" })}>Back to app</button>
          </div>
        </div>
      </main>
    </div>
  );
}
