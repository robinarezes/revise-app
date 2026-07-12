import type { Lesson } from "../types";
import { PhotoImage } from "./PhotoImage";

export function LessonCard({ lesson, onClick }: { lesson: Lesson; onClick: () => void }) {
  const date = new Date(lesson.createdAt).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

  return (
    <button className="lesson-card" onClick={onClick}>
      {lesson.photoIds[0] ? (
        <PhotoImage photoId={lesson.photoIds[0]} className="lesson-thumb" />
      ) : (
        <div className="lesson-thumb" />
      )}
      <div className="card-text">
        <p className="card-name">{lesson.title}</p>
        <p className="card-meta">
          {date} · {lesson.photoIds.length} photo{lesson.photoIds.length > 1 ? "s" : ""}
        </p>
      </div>
    </button>
  );
}
