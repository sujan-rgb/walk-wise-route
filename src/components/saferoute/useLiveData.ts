import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Report, RouteKey } from "@/lib/saferoute";

export interface Contact { id: string; name: string; relation: string | null; phone: string | null; selected: boolean }

type Row = { id: string; category: string; area: string; details: string; status: string };
const toReport = (r: Row): Report => ({ id: r.id, cat: r.category as Category, a: r.area as RouteKey, txt: r.details, st: r.status as Report["st"] });

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    supabase.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

/** Reports shared across all devices, kept in sync in real time. */
export function useReports(user: User | null) {
  const [reps, setReps] = useState<Report[]>([]);
  const [left, setLeft] = useState(3);
  const load = useCallback(async () => {
    const { data } = await supabase.from("reports").select("id,category,area,details,status").order("created_at");
    setReps((data ?? []).map(toReport));
    if (user) { const { data: n } = await supabase.rpc("reports_left"); if (typeof n === "number") setLeft(n); }
  }, [user]);
  useEffect(() => {
    load();
    const ch = supabase.channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const submit = async (cat: Category, a: RouteKey, txt: string) => {
    if (!user) return "Sign in to submit a report.";
    const { error } = await supabase.from("reports").insert({ category: cat, area: a, details: txt, user_id: user.id });
    if (error) return error.message.includes("Rate limit") ? "Rate limit reached. Try again in an hour." : "Couldn't submit the report. Please try again.";
    await load(); return null;
  };
  const moderate = async (id: string, status: "verified" | "rejected") => {
    const { error } = await supabase.from("reports").update({ status, moderated_at: new Date().toISOString() }).eq("id", id);
    if (!error) await load();
    return error ? "Only moderators can do this." : null;
  };
  return { reps, left, submit, moderate };
}

export function useIsModerator(user: User | null) {
  const [mod, setMod] = useState(false);
  useEffect(() => {
    if (!user) return setMod(false);
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => setMod(!!data?.some((r) => r.role === "moderator" || r.role === "admin")));
  }, [user]);
  return mod;
}

export function useContacts(user: User | null) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const load = useCallback(async () => {
    if (!user) return setContacts([]);
    const { data } = await supabase.from("trusted_contacts").select("id,name,relation,phone,selected").order("created_at");
    setContacts(data ?? []);
  }, [user]);
  useEffect(() => { load(); }, [load]);
  return {
    contacts,
    toggle: async (c: Contact) => { setContacts((l) => l.map((x) => (x.id === c.id ? { ...x, selected: !x.selected } : x))); await supabase.from("trusted_contacts").update({ selected: !c.selected }).eq("id", c.id); },
    add: async (name: string, relation: string, phone: string) => { if (!user) return "Sign in first."; const { error } = await supabase.from("trusted_contacts").insert({ name, relation: relation || null, phone: phone || null, user_id: user.id }); if (error) return "Check the phone number format (digits, optional +country code)."; await load(); return null; },
    remove: async (id: string) => { await supabase.from("trusted_contacts").delete().eq("id", id); await load(); },
  };
}
