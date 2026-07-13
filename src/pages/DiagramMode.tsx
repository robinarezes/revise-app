import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { NotFoundScreen } from "../components/NotFoundScreen";
import { getLesson } from "../db/db";
import { useProfile } from "../ProfileContext";
import { BackendError } from "../services/backendClient";
import { generateDiagram } from "../services/diagram";
import type { Lesson } from "../types";

export default function DiagramModePage() {
  const { leconId = "" } = useParams();
  const navigate = useNavigate();
  const { isPremium } = useProfile();
  const [lesson, setLesson] = useState<Lesson | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLesson(leconId).then((l) => {
      setLesson(l);
      if (!l) setNotFound(true);
    });
  }, [leconId]);

  useEffect(() => {
    if (!lesson || !isPremium) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    generateDiagram({ lessonTitle: lesson.title, lessonText: lesson.extractedText })
      .then(async (result) => {
        if (cancelled) return;
        setTitle(result.title);
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral" });
        const { svg } = await mermaid.render(`diagram-${lesson.id}`, result.mermaid);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof BackendError && e.code === "quota_exceeded") {
          navigate("/premium?raison=quota");
          return;
        }
        setError(e instanceof Error ? e.message : "Impossible de générer ce schéma.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson, isPremium, navigate]);

  if (notFound) {
    return <NotFoundScreen title="Schéma" message="Cette leçon n'existe plus ou a été supprimée." />;
  }
  if (!lesson) return <div className="screen" />;

  if (!isPremium) {
    return (
      <div className="screen">
        <Header title="Schéma" />
        <div className="content-center">
          <span className="celebrate-emoji">⭐</span>
          <p className="title-md">Fonctionnalité Premium</p>
          <p className="subtitle">
            La création de schémas par l'IA est réservée aux membres Premium.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => navigate("/premium")}>
            Découvrir Premium
          </button>
          <button className="link-btn" onClick={() => navigate(-1)}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={title ?? "Schéma"} />
      <div className="content">
        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-text">L'IA dessine le schéma de la leçon...</p>
          </div>
        ) : error ? (
          <p className="hint" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : (
          <div className="diagram-container" ref={containerRef} />
        )}
      </div>
    </div>
  );
}
