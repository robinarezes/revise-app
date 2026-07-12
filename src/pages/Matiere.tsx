import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { LessonCard } from "../components/LessonCard";
import { getLessonsBySubject, getSubject } from "../db/db";
import type { Lesson, Subject } from "../types";

export default function MatierePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | undefined>();
  const [lessons, setLessons] = useState<Lesson[] | null>(null);

  useEffect(() => {
    getSubject(id).then(setSubject);
    getLessonsBySubject(id).then(setLessons);
  }, [id]);

  return (
    <div className="screen">
      <Header title={subject?.name ?? "Leçons"} />
      {lessons && lessons.length === 0 ? (
        <div className="empty-state">
          <p className="hint">Aucune leçon dans {subject?.name ?? "cette matière"}</p>
        </div>
      ) : (
        <div className="content">
          <div className="card-list">
            {lessons?.map((l) => (
              <LessonCard key={l.id} lesson={l} onClick={() => navigate(`/lecon/${l.id}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
