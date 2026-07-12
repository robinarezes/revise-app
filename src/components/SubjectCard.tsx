import type { Subject } from "../types";
import { colorForSubject, emojiForSubject } from "../theme";

export function SubjectCard({
  subject,
  lessonCount,
  onClick,
}: {
  subject: Subject;
  lessonCount: number;
  onClick: () => void;
}) {
  return (
    <button className="subject-card" onClick={onClick}>
      <div
        className="subject-icon"
        style={{ background: `${colorForSubject(subject.id)}26` }}
      >
        {emojiForSubject(subject.name, subject.id)}
      </div>
      <div className="card-text">
        <p className="card-name">{subject.name}</p>
        <p className="card-meta">
          {lessonCount} {lessonCount > 1 ? "leçons" : "leçon"}
        </p>
      </div>
      <span className="chevron">›</span>
    </button>
  );
}
