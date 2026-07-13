import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { useProfile } from "../ProfileContext";
import { getCurriculumSubjects } from "../services/curriculum";
import { colorForSubject, emojiForSubject } from "../theme";

export default function GeneralQuizSubjectsPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const grade = profile?.grade ?? null;
  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.grade) return;
    setError(null);
    getCurriculumSubjects(profile.grade, profile.lv1, profile.lv2)
      .then((r) => setSubjects(r.subjects))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }, [profile?.grade, profile?.lv1, profile?.lv2]);

  return (
    <div className="screen">
      <Header title="Quiz général" />
      <div className="content">
        {grade ? <span className="grade-pill">🎓 {grade}</span> : null}
        <p className="hint">Choisis une matière pour lancer un quiz et gagner des points.</p>

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
                className="subject-card"
                onClick={() => navigate(`/quiz-general/${encodeURIComponent(subject)}`)}
              >
                <div
                  className="subject-icon"
                  style={{ background: `${colorForSubject(subject)}26` }}
                >
                  {emojiForSubject(subject, subject)}
                </div>
                <div className="card-text">
                  <p className="card-name">{subject}</p>
                </div>
                <span className="chevron">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
