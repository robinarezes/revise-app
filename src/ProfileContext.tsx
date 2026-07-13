import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Grade } from "./grade";
import type { Language } from "./languages";
import { supabase } from "./supabaseClient";

export type Profile = {
  id: string;
  username: string | null;
  grade: Grade | null;
  lv1: Language | null;
  lv2: Language | null;
  xp: number;
  streak: number;
  last_active_date: string | null;
  dyslexia_mode: boolean;
  subscription_status: string;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  isPremium: boolean;
  updateProfile: (
    patch: Partial<Pick<Profile, "grade" | "lv1" | "lv2" | "dyslexia_mode" | "username">>
  ) => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  recordActivity: () => Promise<void>;
  refetchProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dyslexia-mode", profile?.dyslexia_mode ?? false);
  }, [profile?.dyslexia_mode]);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      return;
    }
    // Compte sans ligne de profil (le trigger de création n'a pas
    // tourné, ou la ligne a été supprimée) : on la recrée pour éviter
    // de rester bloqué indéfiniment sur un écran vide.
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: userId })
      .select()
      .single();
    if (created) {
      setProfile(created as Profile);
      return;
    }
    // L'insertion a échoué (par ex. une autre requête concurrente a déjà
    // créé la ligne entre-temps) : on retente une dernière lecture avant
    // d'abandonner, plutôt que de laisser le profil vide.
    const { data: retried } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile((retried as Profile | null) ?? null);
  }

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProfile(session.user.id)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [session]);

  async function refetchProfile() {
    if (!session) return;
    await fetchProfile(session.user.id);
  }

  async function updateProfile(
    patch: Partial<Pick<Profile, "grade" | "lv1" | "lv2" | "dyslexia_mode" | "username">>
  ) {
    if (!session) return;
    await supabase.from("profiles").update(patch).eq("id", session.user.id);
    setProfile((p) => (p ? { ...p, ...patch } : p));
  }

  async function recordActivity() {
    if (!session || !profile) return;
    const today = todayStr(0);
    let newStreak = profile.streak;
    if (profile.last_active_date === today) {
      return;
    } else if (profile.last_active_date === todayStr(-1)) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
    await supabase
      .from("profiles")
      .update({ streak: newStreak, last_active_date: today })
      .eq("id", session.user.id);
    setProfile((p) => (p ? { ...p, streak: newStreak, last_active_date: today } : p));
  }

  async function addXp(amount: number) {
    if (!session || !profile) return;
    const newXp = profile.xp + amount;
    await supabase.from("profiles").update({ xp: newXp }).eq("id", session.user.id);
    setProfile((p) => (p ? { ...p, xp: newXp } : p));
  }

  const isPremium = profile?.subscription_status === "active";

  return (
    <ProfileContext.Provider
      value={{ profile, loading, isPremium, updateProfile, addXp, recordActivity, refetchProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
