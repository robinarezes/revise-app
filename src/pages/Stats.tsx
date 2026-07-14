import { useEffect, useState } from "react";
import { ADULT_THEMES } from "../adultThemes";
import { BottomNav } from "../components/BottomNav";
import { getLessons } from "../db/db";
import { useProfile } from "../ProfileContext";
import { getExploredThemes } from "../services/exploredThemes";
import { levelInfo } from "../services/level";

type Badge = { icon: string; label: string; unlocked: boolean };

export default function StatsPage() {
  const { profile, isAdultMode } = useProfile();
  const [lessonCount, setLessonCount] = useState(0);
  const [exploredCount, setExploredCount] = useState(0);

  useEffect(() => {
    if (isAdultMode) {
      setExploredCount(getExploredThemes().size);
    } else {
      getLessons().then((lessons) => setLessonCount(lessons.length));
    }
  }, [isAdultMode]);

  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  const longestStreak = profile?.longest_streak ?? 0;
  const freezes = profile?.streak_freezes ?? 0;
  const { level } = levelInfo(xp);

  const badges: Badge[] = isAdultMode
    ? [
        { icon: "🧭", label: "Premier thème exploré", unlocked: exploredCount >= 1 },
        { icon: "🗺️", label: "5 thèmes explorés", unlocked: exploredCount >= 5 },
        { icon: "🌐", label: "Tous les thèmes explorés", unlocked: exploredCount >= ADULT_THEMES.length },
        { icon: "🔥", label: "3 jours de suite", unlocked: streak >= 3 },
        { icon: "🔥🔥", label: "7 jours de suite", unlocked: streak >= 7 },
        { icon: "🔥🔥🔥", label: "30 jours de suite", unlocked: streak >= 30 },
        { icon: "💯", label: "100 XP", unlocked: xp >= 100 },
        { icon: "🎓", label: "500 XP", unlocked: xp >= 500 },
        { icon: "👑", label: "1000 XP", unlocked: xp >= 1000 },
        { icon: "🏅", label: "Niveau 5", unlocked: level >= 5 },
        { icon: "🥇", label: "Niveau 10", unlocked: level >= 10 },
      ]
    : [
        { icon: "🌱", label: "Première leçon", unlocked: lessonCount >= 1 },
        { icon: "📚", label: "10 leçons", unlocked: lessonCount >= 10 },
        { icon: "🔥", label: "3 jours de suite", unlocked: streak >= 3 },
        { icon: "🔥🔥", label: "7 jours de suite", unlocked: streak >= 7 },
        { icon: "🔥🔥🔥", label: "30 jours de suite", unlocked: streak >= 30 },
        { icon: "💯", label: "100 XP", unlocked: xp >= 100 },
        { icon: "🎓", label: "500 XP", unlocked: xp >= 500 },
        { icon: "👑", label: "1000 XP", unlocked: xp >= 1000 },
        { icon: "🏅", label: "Niveau 5", unlocked: level >= 5 },
        { icon: "🥇", label: "Niveau 10", unlocked: level >= 10 },
      ];

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Statistiques</span>
      </div>

      <div className="content">
        <div className="streak-hero">
          <span className="streak-hero-flame">🔥</span>
          <span className="streak-hero-count">{streak}</span>
          <span className="streak-hero-label">jour{streak > 1 ? "s" : ""} de suite</span>
          {freezes > 0 ? (
            <span className="streak-freeze-pill">
              🧊 {freezes} gel{freezes > 1 ? "s" : ""} de série
            </span>
          ) : null}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-value">⭐ {xp}</div>
            <div className="stat-card-label">XP total</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">🏅 {level}</div>
            <div className="stat-card-label">Niveau</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">
              {isAdultMode ? `${exploredCount}/${ADULT_THEMES.length}` : lessonCount}
            </div>
            <div className="stat-card-label">{isAdultMode ? "Thèmes explorés" : "Leçons ajoutées"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">🔥 {longestStreak}</div>
            <div className="stat-card-label">Meilleure série</div>
          </div>
        </div>

        <p className="section-label">Badges</p>
        <div className="badge-grid">
          {badges.map((badge) => (
            <div key={badge.label} className={`badge ${badge.unlocked ? "" : "locked"}`}>
              <span className="badge-icon">{badge.icon}</span>
              <span className="badge-label">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
