import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { PhotoImage } from "../components/PhotoImage";
import { deleteLesson, getLessons, getSubjects } from "../db/db";
import type { Lesson, Subject } from "../types";

export default function LeconsPage() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [subjectsById, setSubjectsById] = useState<Record<string, Subject>>({});

  async function load() {
    const [allLessons, allSubjects] = await Promise.all([getLessons(), getSubjects()]);
    setLessons([...allLessons].sort((a, b) => b.createdAt - a.createdAt));
    setSubjectsById(Object.fromEntries(allSubjects.map((s) => [s.id, s])));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(lesson: Lesson) {
    if (!confirm(`Supprimer "${lesson.title}" ? Cette action est définitive.`)) return;
    await deleteLesson(lesson.id);
    load();
  }

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Leçons</span>
      </div>

      {lessons && lessons.length === 0 ? (
        <div className="empty-state">
          <div className="mascot">📑</div>
          <p className="title-md">Aucune leçon pour l'instant</p>
          <p className="hint">
            Tes leçons (photographiées ou générées depuis le Programme) apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="content">
          <div className="card-list">
            {lessons?.map((lesson) => {
              const date = new Date(lesson.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              });
              const subjectName = subjectsById[lesson.subjectId]?.name ?? "";
              return (
                <div key={lesson.id} className="lesson-row">
                  <button className="lesson-card" onClick={() => navigate(`/lecon/${lesson.id}`)}>
                    {lesson.photoIds[0] ? (
                      <PhotoImage photoId={lesson.photoIds[0]} className="lesson-thumb" />
                    ) : (
                      <div className="lesson-thumb" />
                    )}
                    <div className="card-text">
                      <p className="card-name">{lesson.title}</p>
                      <p className="card-meta">
                        {subjectName ? `${subjectName} · ` : ""}
                        {date}
                      </p>
                    </div>
                  </button>
                  <button
                    className="lesson-delete-btn"
                    onClick={() => handleDelete(lesson)}
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
