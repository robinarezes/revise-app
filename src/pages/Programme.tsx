import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { getGrade } from "../grade";
import { getCurriculumSubjects } from "../services/curriculum";
import { colorForSubject, emojiForSubject } from "../theme";

export default function ProgrammePage() {
  const navigate = useNavigate();
  const grade = getGrade();
  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!grade) return;
    setError(null);
    getCurriculumSubjects(grade)
      .then((r) => setSubjects(r.subjects))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }, [grade]);

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Programme</span>
      </div>
      <div className="content">
        {grade ? <span className="grade-pill">🎓 {grade}</span> : null}

        {error ? (
          <div className="empty-state">
            <p className="hint">{error}</p>
          </div>
        ) : !subjects ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-text">Chargement du programme...</p>
          </div>
        ) : (
          <div className="card-list">
            {subjects.map((subject) => (
              <button
                key={subject}
                className="subject-card"
                onClick={() => navigate(`/programme/${encodeURIComponent(subject)}`)}
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

      <BottomNav />
    </div>
  );
}
