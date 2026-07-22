import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "worker" | null;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) loadRole(data.session.user.id);
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadRole(s.user.id);
      else {
        setRole(null);
        setLoading(false);
      }
    });
    async function loadRole(uid: string) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle();
      setRole((data?.role as Role) ?? "worker");
      setLoading(false);
    }
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, role, loading, isAdmin: role === "admin" };
}
