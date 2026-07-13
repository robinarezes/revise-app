import { useNavigate } from "react-router-dom";
import type { Lesson } from "../types";
import { PhotoImage } from "./PhotoImage";

export function LessonCard({
  lesson,
  onClick,
  onDelete,
  subjectName,
}: {
  lesson: Lesson;
  onClick: () => void;
  onDelete?: () => void;
  subjectName?: string;
}) {
  const navigate = useNavigate();
  const date = new Date(lesson.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="lesson-card">
      <div className="lesson-card-top">
        <button className="lesson-card-open" onClick={onClick}>
          {lesson.photoIds[0] ? (
            <PhotoImage photoId={lesson.photoIds[0]} className="lesson-thumb" />
          ) : (
            <div className="lesson-thumb lesson-thumb-placeholder">📖</div>
          )}
          <div className="card-text">
            <p className="card-name">{lesson.title}</p>
            <p className="card-meta">
              {subjectName ? `${subjectName} · ` : ""}
              {date} · {lesson.photoIds.length} photo{lesson.photoIds.length > 1 ? "s" : ""}
            </p>
          </div>
        </button>
        {onDelete ? (
          <button className="lesson-delete-btn" onClick={onDelete} aria-label="Supprimer">
            ✕
          </button>
        ) : null}
      </div>
      <div className="lesson-card-actions">
        <button className="lesson-action-btn" onClick={() => navigate(`/revision/${lesson.id}`)}>
          📖 Réviser
        </button>
        <button
          className="lesson-action-btn"
          onClick={() => navigate(`/revision/${lesson.id}?auto=apprendre`)}
        >
          📘 Leçon
        </button>
      </div>
    </div>
  );
}
