import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADULT_THEMES } from "../adultThemes";
import { BottomNav } from "../components/BottomNav";
import { SubjectCard } from "../components/SubjectCard";
import { todayParis } from "../dateUtils";
import {
  countPendingInvitations,
  getDailyQuizResults,
  getSubjectsWithLessonCounts,
  type DailyQuizResultRow,
} from "../db/db";
import type { Difficulty } from "../services/generalQuiz";
import { triggerConfetti } from "../services/confetti";
import { getExploredThemes } from "../services/exploredThemes";
import { getFactOfDay, type FactOfDay } from "../services/factOfDay";
import { levelInfo } from "../services/level";
import { useProfile } from "../ProfileContext";
import { colorForSubject, gradientForSubject } from "../theme";
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

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; icon: string }[] = [
  { value: "facile", label: "Facile", icon: "🙂" },
  { value: "moyen", label: "Moyen", icon: "🙃" },
  { value: "difficile", label: "Difficile", icon: "🔥" },
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
  const [difficulty, setDifficulty] = useState<Difficulty>("moyen");
  const [exploredThemes, setExploredThemes] = useState<Set<string>>(new Set());
  const [fact, setFact] = useState<FactOfDay | null>(null);
  const [factError, setFactError] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState(0);

  useEffect(() => {
    if (!isAdultMode) getSubjectsWithLessonCounts().then(setSubjects);
    getDailyQuizResults(todayStr())
      .then(setDailyResults)
      .catch(() => {});
  }, [isAdultMode]);

  useEffect(() => {
    if (isAdultMode) return;
    countPendingInvitations()
      .then(setPendingInvitations)
      .catch(() => {});
  }, [isAdultMode]);

  useEffect(() => {
    if (!isAdultMode) return;
    setExploredThemes(getExploredThemes());
    getFactOfDay()
      .then(setFact)
      .catch(() => setFactError(true));
  }, [isAdultMode]);

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
          <span className="tab-header-title">{isAdultMode ? "Culture Générale" : "Mes matières"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            {!isAdultMode ? (
              <button
                className="stat-pill"
                style={{ position: "relative", cursor: "pointer" }}
                onClick={() => navigate("/classes")}
              >
                🏫 Classe
                {pendingInvitations > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      background: "var(--danger)",
                      color: "#fff",
                      borderRadius: "999px",
                      minWidth: 18,
                      height: 18,
                      fontSize: 11,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                    }}
                  >
                    {pendingInvitations}
                  </span>
                ) : null}
              </button>
            ) : null}
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

        {!isAdultMode ? (
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
        ) : null}

        {isAdultMode ? (
          <div className="quiz-general-card" style={{ alignItems: "flex-start" }}>
            <span className="quiz-general-icon">💡</span>
            <div className="card-text">
              <p className="card-name">Le saviez-vous ?</p>
              {fact ? (
                <>
                  <p className="mode-btn-subtitle">{fact.fact}</p>
                  <span className="grade-pill" style={{ marginTop: 6 }}>
                    {fact.theme}
                  </span>
                </>
              ) : factError ? (
                <p className="mode-btn-subtitle">Indisponible pour l'instant, réessaie plus tard.</p>
              ) : (
                <p className="mode-btn-subtitle">Chargement du fait du jour...</p>
              )}
            </div>
          </div>
        ) : null}

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

        {!isAdultMode ? (
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
        ) : null}

        {isAdultMode ? (
          <>
            <label className="field-label">Difficulté</label>
            <div className="option-pills">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`option-pill ${difficulty === opt.value ? "option-pill-selected" : ""}`}
                  onClick={() => setDifficulty(opt.value)}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>

            <p className="section-label" style={{ marginTop: 16 }}>
              Thèmes à explorer
            </p>
            <div className="card-list">
              {ADULT_THEMES.map((theme) => {
                const isExplored = exploredThemes.has(theme.name);
                return (
                  <button
                    key={theme.name}
                    className="subject-card"
                    style={{ borderLeftColor: colorForSubject(theme.name) }}
                    onClick={() =>
                      navigate(`/quiz-general/${encodeURIComponent(theme.name)}?difficulty=${difficulty}`)
                    }
                  >
                    <div className="subject-icon" style={{ background: gradientForSubject(theme.name) }}>
                      {theme.icon}
                    </div>
                    <div className="card-text">
                      <p className="card-name">{theme.label}</p>
                    </div>
                    <span className="chevron">{isExplored ? "✅" : "›"}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {!isAdultMode && subjects && subjects.length === 0 ? (
        <div className="empty-state">
          <div className="mascot">📚</div>
          <p className="title-md">Aucune leçon pour l'instant</p>
          <p className="hint">
            Prends en photo ton premier cours, l'IA le classera automatiquement par matière.
          </p>
        </div>
      ) : !isAdultMode ? (
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
      ) : null}

      <BottomNav />
    </div>
  );
}
