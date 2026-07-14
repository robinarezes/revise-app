import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { todayParis } from "./dateUtils";
import { ADULT_GRADE, KIDS_GRADES, type Grade } from "./grade";
import type { Language } from "./languages";
import { supabase } from "./supabaseClient";

export type DyslexiaFont = "system" | "opendyslexic" | "lexend";
export type DyslexiaTint = "none" | "cream" | "blue" | "green" | "pink";
export type DyslexiaSize = "small" | "medium" | "large";

export type Profile = {
  id: string;
  username: string | null;
  grade: Grade | null;
  lv1: Language | null;
  lv2: Language | null;
  xp: number;
  streak: number;
  longest_streak: number;
  streak_freezes: number;
  last_active_date: string | null;
  dyslexia_mode: boolean;
  dyslexia_font: DyslexiaFont;
  dyslexia_tint: DyslexiaTint;
  dyslexia_size: DyslexiaSize;
  tts_voice: string;
  subscription_status: string;
};

type EditablePatch = Partial<
  Pick<
    Profile,
    | "grade"
    | "lv1"
    | "lv2"
    | "dyslexia_mode"
    | "dyslexia_font"
    | "dyslexia_tint"
    | "dyslexia_size"
    | "tts_voice"
    | "username"
  >
>;

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  isPremium: boolean;
  isKidsMode: boolean;
  isAdultMode: boolean;
  updateProfile: (patch: EditablePatch) => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  recordActivity: () => Promise<void>;
  refetchProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

function todayStr(offsetDays = 0): string {
  return todayParis(offsetDays);
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dyslexia-mode", profile?.dyslexia_mode ?? false);
    root.setAttribute("data-dys-font", profile?.dyslexia_font ?? "system");
    root.setAttribute("data-dys-tint", profile?.dyslexia_tint ?? "cream");
    root.setAttribute("data-dys-size", profile?.dyslexia_size ?? "medium");
  }, [profile?.dyslexia_mode, profile?.dyslexia_font, profile?.dyslexia_tint, profile?.dyslexia_size]);

  useEffect(() => {
    const kids = profile?.grade ? (KIDS_GRADES as readonly string[]).includes(profile.grade) : false;
    document.documentElement.classList.toggle("kids-mode", kids);
  }, [profile?.grade]);

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

  async function updateProfile(patch: EditablePatch) {
    if (!session) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", session.user.id);
    if (error) throw error;
    setProfile((p) => (p ? { ...p, ...patch } : p));
  }

  async function recordActivity() {
    if (!session || !profile) return;
    const today = todayStr(0);
    let newStreak = profile.streak;
    let newFreezes = profile.streak_freezes;
    let usedFreeze = false;
    if (profile.last_active_date === today) {
      return;
    } else if (profile.last_active_date === todayStr(-1)) {
      newStreak += 1;
    } else if (profile.last_active_date === todayStr(-2) && profile.streak_freezes > 0 && profile.streak > 0) {
      // Un jour manqué : un gel de série protège le compteur au lieu de le
      // remettre à zéro, comme un joker.
      newFreezes -= 1;
      usedFreeze = true;
    } else {
      newStreak = 1;
    }
    // Un gel se regagne tous les 7 jours de série (max 3 en stock), pour
    // récompenser la régularité sans rendre le joker illimité.
    if (!usedFreeze && newStreak > 0 && newStreak % 7 === 0 && newFreezes < 3) {
      newFreezes += 1;
    }
    const newLongest = Math.max(profile.longest_streak, newStreak);
    await supabase
      .from("profiles")
      .update({
        streak: newStreak,
        streak_freezes: newFreezes,
        longest_streak: newLongest,
        last_active_date: today,
      })
      .eq("id", session.user.id);
    setProfile((p) =>
      p
        ? {
            ...p,
            streak: newStreak,
            streak_freezes: newFreezes,
            longest_streak: newLongest,
            last_active_date: today,
          }
        : p
    );
  }

  async function addXp(amount: number) {
    if (!session || !profile) return;
    const newXp = profile.xp + amount;
    await supabase.from("profiles").update({ xp: newXp }).eq("id", session.user.id);
    setProfile((p) => (p ? { ...p, xp: newXp } : p));
  }

  const isPremium = profile?.subscription_status === "active";
  const isKidsMode = profile?.grade
    ? (KIDS_GRADES as readonly string[]).includes(profile.grade)
    : false;
  const isAdultMode = profile?.grade === ADULT_GRADE;

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        isPremium,
        isKidsMode,
        isAdultMode,
        updateProfile,
        addXp,
        recordActivity,
        refetchProfile,
      }}
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
