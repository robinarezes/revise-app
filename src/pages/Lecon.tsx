import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { PhotoImage } from "../components/PhotoImage";
import { deleteLesson, getLesson } from "../db/db";
import type { Lesson } from "../types";

export default function LeconPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lesson, setLesson] = useState<Lesson | undefined>();
  const xpEarned = (location.state as { xpEarned?: number } | null)?.xpEarned;

  useEffect(() => {
    getLesson(id).then(setLesson);
  }, [id]);

  async function handleDelete() {
    if (!confirm("Supprimer cette leçon ? Les photos et le quiz associés seront supprimés.")) return;
    await deleteLesson(id);
    navigate(-1);
  }

  if (!lesson) return <div className="screen" />;

  return (
    <div className="screen">
      <Header title={lesson.title} />
      <div className="content">
        {xpEarned ? (
          <span className="xp-toast">🎉 Leçon ajoutée · +{xpEarned} ⭐ XP</span>
        ) : null}

        <div className="photo-row">
          {lesson.photoIds.map((photoId) => (
            <PhotoImage key={photoId} photoId={photoId} className="photo-large" />
          ))}
        </div>

        <p className="section-label">Contenu extrait</p>
        <p className="extracted-text">{lesson.extractedText}</p>

        <button
          className="btn btn-primary btn-block"
          onClick={() => navigate(`/revision/${lesson.id}`)}
        >
          Réviser cette leçon
        </button>

        <button className="link-btn-danger" onClick={handleDelete}>
          Supprimer la leçon
        </button>
      </div>
    </div>
  );
}
