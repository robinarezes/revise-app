import { useEffect, useState } from "react";
import { BottomNav } from "../components/BottomNav";
import { getLessons } from "../db/db";
import { useProfile } from "../ProfileContext";

type Badge = { icon: string; label: string; unlocked: boolean };

export default function StatsPage() {
  const { profile } = useProfile();
  const [lessonCount, setLessonCount] = useState(0);

  useEffect(() => {
    getLessons().then((lessons) => setLessonCount(lessons.length));
  }, []);

  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;

  const badges: Badge[] = [
    { icon: "🌱", label: "Première leçon", unlocked: lessonCount >= 1 },
    { icon: "📚", label: "10 leçons", unlocked: lessonCount >= 10 },
    { icon: "🔥", label: "3 jours de suite", unlocked: streak >= 3 },
    { icon: "🔥🔥", label: "7 jours de suite", unlocked: streak >= 7 },
    { icon: "💯", label: "100 XP", unlocked: xp >= 100 },
    { icon: "🎓", label: "500 XP", unlocked: xp >= 500 },
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
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-value">⭐ {xp}</div>
            <div className="stat-card-label">XP total</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">{lessonCount}</div>
            <div className="stat-card-label">Leçons ajoutées</div>
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
