import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { LessonCard } from "../components/LessonCard";
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
            {lessons?.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                subjectName={subjectsById[lesson.subjectId]?.name}
                onClick={() => navigate(`/lecon/${lesson.id}`)}
                onDelete={() => handleDelete(lesson)}
              />
            ))}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
