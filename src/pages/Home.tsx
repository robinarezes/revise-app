import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { SubjectCard } from "../components/SubjectCard";
import { getSubjectsWithLessonCounts } from "../db/db";
import { useProfile } from "../ProfileContext";
import type { Subject } from "../types";

export default function HomePage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [subjects, setSubjects] = useState<(Subject & { lessonCount: number })[] | null>(null);

  useEffect(() => {
    getSubjectsWithLessonCounts().then(setSubjects);
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
