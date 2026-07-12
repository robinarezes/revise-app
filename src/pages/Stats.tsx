import { useEffect, useState } from "react";
import { BottomNav } from "../components/BottomNav";
import { getLessons } from "../db/db";
import { getStats, type Stats } from "../stats";

type Badge = { icon: string; label: string; unlocked: boolean };

export default function StatsPage() {
  const [stats, setStats] = useState<Stats>({ xp: 0, streak: 0, lastActiveDate: null });
  const [lessonCount, setLessonCount] = useState(0);

  useEffect(() => {
    setStats(getStats());
    getLessons().then((lessons) => setLessonCount(lessons.length));
  }, []);

  const badges: Badge[] = [
    { icon: "🌱", label: "Première leçon", unlocked: lessonCount >= 1 },
    { icon: "📚", label: "10 leçons", unlocked: lessonCount >= 10 },
    { icon: "🔥", label: "3 jours de suite", unlocked: stats.streak >= 3 },
    { icon: "🔥🔥", label: "7 jours de suite", unlocked: stats.streak >= 7 },
    { icon: "💯", label: "100 XP", unlocked: stats.xp >= 100 },
    { icon: "🎓", label: "500 XP", unlocked: stats.xp >= 500 },
  ];

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Statistiques</span>
      </div>

      <div className="content">
        <div className="streak-hero">
          <span className="streak-hero-flame">🔥</span>
          <span className="streak-hero-count">{stats.streak}</span>
          <span className="streak-hero-label">
            jour{stats.streak > 1 ? "s" : ""} de suite
          </span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-value">⭐ {stats.xp}</div>
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
