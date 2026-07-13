import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { useProfile } from "../ProfileContext";
import { getCurriculumSubjects } from "../services/curriculum";
import { colorForSubject, emojiForSubject, gradientForSubject } from "../theme";

export default function ProgrammePage() {
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
                style={{ borderLeftColor: colorForSubject(subject) }}
              >
                <div className="subject-icon" style={{ background: gradientForSubject(subject) }}>
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
