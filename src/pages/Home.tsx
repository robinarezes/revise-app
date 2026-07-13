import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { SubjectCard } from "../components/SubjectCard";
import { getDailyQuizResults, getSubjectsWithLessonCounts, type DailyQuizResultRow } from "../db/db";
import { useProfile } from "../ProfileContext";
import type { Subject } from "../types";

const DAILY_QUIZ_SUBJECTS = [
  { name: "Mathématiques", label: "Maths", icon: "🧮" },
  { name: "Français", label: "Français", icon: "📖" },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HomePage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [subjects, setSubjects] = useState<(Subject & { lessonCount: number })[] | null>(null);
  const [dailyResults, setDailyResults] = useState<DailyQuizResultRow[]>([]);

  useEffect(() => {
    getSubjectsWithLessonCounts().then(setSubjects);
    getDailyQuizResults(todayStr())
      .then(setDailyResults)
      .catch(() => {});
  }, []);

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Mes matières</span>
        <div className="stat-pills">
          <span className="stat-pill">
            <span className="stat-pill-icon">🔥</span>
            {profile?.streak ?? 0}
          </span>
          <span className="stat-pill">
            <span className="stat-pill-icon">⭐</span>
            {profile?.xp ?? 0}
          </span>
        </div>
      </div>

      <div className="content" style={{ paddingBottom: 0 }}>
        <p className="section-label">Quiz du jour</p>
        <div className="daily-quiz-row">
          {DAILY_QUIZ_SUBJECTS.map((s) => {
            const result = dailyResults.find((r) => r.subject === s.name);
            return (
              <button
                key={s.name}
                className="daily-quiz-card"
                onClick={() => navigate(`/quiz-du-jour/${encodeURIComponent(s.name)}`)}
              >
                {result ? (
                  <>
                    <span className="daily-quiz-done-badge">✅</span>
                    <span className="daily-quiz-label">{s.label}</span>
                    <span className="daily-quiz-score">
                      {result.score}/{result.total}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="daily-quiz-icon">{s.icon}</span>
                    <span className="daily-quiz-label">{s.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <p className="section-label" style={{ marginTop: 20 }}>
          Quiz
        </p>
        <button className="quiz-general-card" onClick={() => navigate("/quiz-general")}>
          <span className="quiz-general-icon">🏆</span>
          <div className="card-text">
            <p className="card-name">Quiz général</p>
            <p className="mode-btn-subtitle">Gagne des points sur toutes les matières, à volonté</p>
          </div>
          <span className="chevron">›</span>
        </button>
      </div>

      {subjects && subjects.length === 0 ? (
        <div className="empty-state">
          <div className="mascot">📚</div>
          <p className="title-md">Aucune leçon pour l'instant</p>
          <p className="hint">
            Prends en photo ton premier cours, l'IA le classera automatiquement par matière.
          </p>
        </div>
      ) : (
        <div className="content">
          <div className="card-list">
            {subjects?.map((s) => (
              <SubjectCard
                key={s.id}
                subject={s}
                lessonCount={s.lessonCount}
                onClick={() => navigate(`/matiere/${s.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="fab-anchor">
        <button className="fab" onClick={() => navigate("/capture")}>
          +
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
