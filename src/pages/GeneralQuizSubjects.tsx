import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useProfile } from "../ProfileContext";
import { getCurriculumSubjects } from "../services/curriculum";
import type { Difficulty } from "../services/generalQuiz";
import { colorForSubject, emojiForSubject, gradientForSubject } from "../theme";

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; icon: string }[] = [
  { value: "facile", label: "Facile", icon: "🙂" },
  { value: "moyen", label: "Moyen", icon: "🙃" },
  { value: "difficile", label: "Difficile", icon: "🔥" },
];

export default function GeneralQuizSubjectsPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const grade = profile?.grade ?? null;
  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("moyen");
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.grade) return;
    setError(null);
    getCurriculumSubjects(profile.grade, profile.lv1, profile.lv2)
      .then((r) => setSubjects(r.subjects))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }, [profile?.grade, profile?.lv1, profile?.lv2]);

  function startQuiz(subjectValue: string) {
    navigate(`/quiz-general/${encodeURIComponent(subjectValue)}?difficulty=${difficulty}`);
  }

  function toggleSelected(subject: string) {
    setSelected((s) => (s.includes(subject) ? s.filter((x) => x !== subject) : [...s, subject]));
  }

  return (
    <div className="screen">
      <Header title="Quiz général" />
      <div className="content">
        {grade ? <span className="grade-pill">🎓 {grade}</span> : null}
        <p className="hint">Choisis une matière pour lancer un quiz et gagner des points.</p>

        <label className="field-label" style={{ marginTop: 4 }}>
          Difficulté
        </label>
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

        <button
          className="quiz-general-card quiz-culture-card"
          style={{ marginTop: 16 }}
          onClick={() => startQuiz("Toutes les matières")}
        >
          <span className="quiz-general-icon">🌐</span>
          <div className="card-text">
            <p className="card-name">Toutes les matières</p>
            <p className="mode-btn-subtitle">Un quiz qui mélange tout le programme</p>
          </div>
          <span className="chevron">›</span>
        </button>

        <div className="actions-row" style={{ marginTop: 16, alignItems: "center" }}>
          <p className="section-label" style={{ margin: 0 }}>
            Ou choisis une matière
          </p>
          <button
            className="link-btn"
            style={{ padding: 0, marginLeft: "auto" }}
            onClick={() => {
              setMultiMode((m) => !m);
              setSelected([]);
            }}
          >
            {multiMode ? "Annuler" : "Sélectionner plusieurs matières"}
          </button>
        </div>

        {error ? (
          <div className="empty-state">
            <p className="hint">{error}</p>
          </div>
        ) : !subjects ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-text">Chargement des matières...</p>
          </div>
        ) : (
          <div className="card-list">
            {subjects.map((subject) => (
              <button
                key={subject}
                className={`subject-card ${selected.includes(subject) ? "option-pill-selected" : ""}`}
                onClick={() => (multiMode ? toggleSelected(subject) : startQuiz(subject))}
                style={{ borderLeftColor: colorForSubject(subject) }}
              >
                <div className="subject-icon" style={{ background: gradientForSubject(subject) }}>
                  {emojiForSubject(subject, subject)}
                </div>
                <div className="card-text">
                  <p className="card-name">{subject}</p>
                </div>
                <span className="chevron">{multiMode ? (selected.includes(subject) ? "✅" : "") : "›"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {multiMode && selected.length > 0 ? (
        <div className="content" style={{ paddingTop: 0 }}>
          <button className="btn btn-primary btn-block" onClick={() => startQuiz(selected.join(", "))}>
            Lancer le quiz ({selected.length} matière{selected.length > 1 ? "s" : ""})
          </button>
        </div>
      ) : null}
    </div>
  );
}
