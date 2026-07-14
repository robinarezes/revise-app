import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { SubjectCard } from "../components/SubjectCard";
import { todayParis } from "../dateUtils";
import { getDailyQuizResults, getSubjectsWithLessonCounts, type DailyQuizResultRow } from "../db/db";
import { triggerConfetti } from "../services/confetti";
import { levelInfo } from "../services/level";
import { useProfile } from "../ProfileContext";
import type { Subject } from "../types";

const DAILY_QUIZ_SUBJECTS = [
  { name: "Mathématiques", label: "Maths", icon: "🧮" },
  { name: "Français", label: "Français", icon: "📖" },
  { name: "Histoire", label: "Histoire", icon: "🏛️" },
  { name: "Culture générale", label: "Culture G", icon: "🧠" },
];

// Mode Adulte : pas de programme scolaire, tout tourne autour de la
// culture générale.
const ADULT_DAILY_QUIZ_SUBJECTS = [
  { name: "Culture générale", label: "Culture G", icon: "🧠" },
  { name: "Actualité et monde", label: "Actualité", icon: "🌍" },
  { name: "Sciences", label: "Sciences", icon: "🔬" },
  { name: "Histoire", label: "Histoire", icon: "🏛️" },
];

function todayStr(): string {
  return todayParis();
}

export default function HomePage() {
  const navigate = useNavigate();
  const { profile, isAdultMode } = useProfile();
  const [subjects, setSubjects] = useState<(Subject & { lessonCount: number })[] | null>(null);
  const [dailyResults, setDailyResults] = useState<DailyQuizResultRow[]>([]);
  const seenLevel = useRef<number | null>(null);
  const dailyQuizSubjects = isAdultMode ? ADULT_DAILY_QUIZ_SUBJECTS : DAILY_QUIZ_SUBJECTS;

  useEffect(() => {
    getSubjectsWithLessonCounts().then(setSubjects);
    getDailyQuizResults(todayStr())
      .then(setDailyResults)
      .catch(() => {});
  }, []);

  const xp = profile?.xp ?? 0;
  const { level, progress } = levelInfo(xp);

  useEffect(() => {
    if (seenLevel.current !== null && level > seenLevel.current) {
      triggerConfetti();
    }
    seenLevel.current = level;
  }, [level]);

  const streak = profile?.streak ?? 0;
  const doneToday = dailyResults.length;
  const streakAtRisk = streak > 0 && doneToday < dailyQuizSubjects.length;

  return (
    <div className="screen">
      <div className="tab-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="tab-header-title">Mes matières</span>
          <div className="stat-pills">
            <span className="stat-pill">
              <span className="stat-pill-icon">🔥</span>
              {streak}
            </span>
            <span className="stat-pill">
              <span className="stat-pill-icon">⭐</span>
              {xp}
            </span>
            <span className="stat-pill">🏅 Niv. {level}</span>
          </div>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      </div>

      <div className="content" style={{ paddingBottom: 0 }}>
        {streakAtRisk ? (
          <div className="streak-risk-banner">
            🔥 Ta série de {streak} jour{streak > 1 ? "s" : ""} est en jeu — fais le Quiz du jour avant
            minuit pour la garder !
          </div>
        ) : null}

        <button className="scan-hero-btn" onClick={() => navigate("/capture")}>
          <span className="scan-hero-icon">📸</span>
          <div className="card-text">
            <p className="scan-hero-title">Scanner un cours</p>
            <p className="scan-hero-subtitle">Prends en photo tes feuilles, l'IA crée la leçon</p>
          </div>
          <span className="chevron" style={{ color: "var(--yellow-text)" }}>
            ›
          </span>
        </button>

        <p className="section-label" style={{ marginTop: 20 }}>
          🔥 Quiz du jour
        </p>
        <div className="daily-quiz-row">
          {dailyQuizSubjects.map((s) => {
            const result = dailyResults.find((r) => r.subject === s.name);
            return (
              <button
                key={s.name}
                className={`daily-quiz-card ${result ? "daily-quiz-card-done" : "daily-quiz-card-todo"}`}
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
        {!isAdultMode ? (
          <button className="quiz-general-card" onClick={() => navigate("/quiz-general")}>
            <span className="quiz-general-icon">🏆</span>
            <div className="card-text">
              <p className="card-name">Quiz général</p>
              <p className="mode-btn-subtitle">Choisis une matière et gagne des points, à volonté</p>
            </div>
            <span className="chevron">›</span>
          </button>
        ) : null}

        <button
          className="quiz-general-card quiz-culture-card"
          onClick={() => navigate(`/quiz-general/${encodeURIComponent("Culture générale")}`)}
        >
          <span className="quiz-general-icon">🧠</span>
          <div className="card-text">
            <p className="card-name">Culture Générale</p>
            <p className="mode-btn-subtitle">
              Histoire, géo, sciences, actu... teste-toi hors du programme scolaire
            </p>
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

      <BottomNav />
    </div>
  );
}
