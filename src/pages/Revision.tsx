import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { NotFoundScreen } from "../components/NotFoundScreen";
import { getLesson, getQuizSet, saveQuizSet } from "../db/db";
import { useProfile } from "../ProfileContext";
import { BackendError } from "../services/backendClient";
import { generateQuiz } from "../services/generateQuiz";
import type { Lesson, QuizSet } from "../types";

const AUTO_MODES = new Set(["exercice", "qcm", "flashcards", "apprendre", "demander"]);

export default function RevisionPage() {
  const { leconId = "" } = useParams();
  const navigate = useNavigate();
  const { isPremium } = useProfile();
  const [searchParams] = useSearchParams();
  const autoMode = searchParams.get("auto");
  const [lesson, setLesson] = useState<Lesson | undefined>();
  const [quizSet, setQuizSet] = useState<QuizSet | undefined>();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getLesson(leconId), getQuizSet(leconId)]).then(([l, q]) => {
      setLesson(l);
      setQuizSet(q);
      setLoading(false);
    });
  }, [leconId]);

  async function handleGenerate() {
    if (!lesson) return;
    setGenerating(true);
    try {
      const result = await generateQuiz({
        lessonTitle: lesson.title,
        lessonText: lesson.extractedText,
      });
      const saved = await saveQuizSet(
        lesson.id,
        result.qcm,
        result.flashcards,
        result.lessonCards,
        result.exercises
      );
      setQuizSet(saved);
    } catch (e) {
      if (e instanceof BackendError && e.code === "quota_exceeded") {
        navigate("/premium?raison=quota");
        return;
      }
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      alert(`Échec de la génération : ${message}`);
    } finally {
      setGenerating(false);
    }
  }

  // Accès direct depuis la carte de leçon ("Exercice") : génère le contenu
  // au besoin puis saute directement dans le mode demandé, sans passer par
  // ce choix intermédiaire.
  useEffect(() => {
    if (!autoMode || !AUTO_MODES.has(autoMode) || loading || generating || !lesson) return;
    if (!quizSet) {
      handleGenerate();
      return;
    }
    navigate(`/revision/${leconId}/${autoMode}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, loading, generating, quizSet, lesson, leconId]);

  if (loading) return <div className="screen" />;
  if (!lesson) {
    return (
      <NotFoundScreen
        title="Réviser"
        message="Cette leçon n'existe plus ou a été supprimée."
      />
    );
  }

  if (generating) {
    return (
      <div className="screen">
        <Header title="Réviser" />
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-text">L'IA prépare ta leçon, ton quiz et tes exercices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={lesson.title} />

      {!quizSet ? (
        <div className="content-center">
          <p className="title-md">Prêt à réviser "{lesson.title}" ?</p>
          <p className="subtitle">
            L'IA va préparer une leçon expliquée, des QCM, des flashcards et des exercices à
            partir du contenu de cette leçon.
          </p>
          <button className="btn btn-primary btn-block" onClick={handleGenerate}>
            Générer
          </button>
          <button
            className="mode-btn"
            onClick={() => navigate(`/revision/${lesson.id}/demander`)}
          >
            <p className="mode-btn-title">💬 Demander</p>
            <p className="mode-btn-subtitle">Pose librement des questions sur cette leçon</p>
          </button>
          <button className="link-btn" onClick={() => navigate("/")}>
            🏠 Retour à l'accueil
          </button>
        </div>
      ) : (
        <div className="content-center">
          <p className="title-md">Choisis un mode de révision</p>
          <button
            className="mode-btn"
            onClick={() => navigate(`/revision/${lesson.id}/demander`)}
          >
            <p className="mode-btn-title">💬 Demander</p>
            <p className="mode-btn-subtitle">Pose librement des questions sur cette leçon</p>
          </button>
          <button className="mode-btn" onClick={() => navigate(`/revision/${lesson.id}/apprendre`)}>
            <p className="mode-btn-title">📖 Leçon</p>
            <p className="mode-btn-subtitle">
              {quizSet.lessonCards.length} notions expliquées simplement
            </p>
          </button>
          <button className="mode-btn" onClick={() => navigate(`/revision/${lesson.id}/qcm`)}>
            <p className="mode-btn-title">✅ QCM</p>
            <p className="mode-btn-subtitle">{quizSet.qcm.length} questions à choix multiples</p>
          </button>
          <button
            className="mode-btn"
            onClick={() => navigate(`/revision/${lesson.id}/flashcards`)}
          >
            <p className="mode-btn-title">🔄 Flashcards</p>
            <p className="mode-btn-subtitle">{quizSet.flashcards.length} questions/réponses</p>
          </button>
          <button
            className="mode-btn"
            onClick={() => navigate(`/revision/${lesson.id}/exercice`)}
          >
            <p className="mode-btn-title">✍️ Exercice</p>
            <p className="mode-btn-subtitle">
              {quizSet.exercises.length} questions ouvertes corrigées par l'IA
            </p>
          </button>
          <button className="mode-btn" onClick={() => navigate(`/revision/${lesson.id}/schema`)}>
            <p className="mode-btn-title">🧩 Schéma {isPremium ? "" : "⭐"}</p>
            <p className="mode-btn-subtitle">
              {isPremium ? "Un schéma généré par l'IA pour visualiser la leçon" : "Fonctionnalité Premium"}
            </p>
          </button>
          <button className="link-btn" onClick={handleGenerate}>
            Régénérer un nouveau contenu
          </button>
          <button className="link-btn" onClick={() => navigate("/")}>
            🏠 Retour à l'accueil
          </button>
        </div>
      )}
    </div>
  );
}
