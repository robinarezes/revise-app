import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Grade } from "./grade";
import type { Language } from "./languages";
import { supabase } from "./supabaseClient";

export type Profile = {
  id: string;
  grade: Grade | null;
  lv1: Language | null;
  lv2: Language | null;
  xp: number;
  streak: number;
  last_active_date: string | null;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (patch: Partial<Pick<Profile, "grade" | "lv1" | "lv2">>) => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  recordActivity: () => Promise<void>;
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
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setLoading(false);
      });
  }, [session]);

  async function updateProfile(patch: Partial<Pick<Profile, "grade" | "lv1" | "lv2">>) {
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

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, addXp, recordActivity }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
