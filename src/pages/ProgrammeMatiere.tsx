import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { createLesson, findOrCreateSubject, generateId, saveQuizSet } from "../db/db";
import { useProfile } from "../ProfileContext";
import { getCurriculumLesson, getCurriculumTopics } from "../services/curriculum";

export default function ProgrammeMatierePage() {
  const { matiere = "" } = useParams();
  const subject = decodeURIComponent(matiere);
  const navigate = useNavigate();
  const { profile } = useProfile();
  const grade = profile?.grade ?? null;
  const [topics, setTopics] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);

  useEffect(() => {
    if (!grade) return;
    setError(null);
    getCurriculumTopics(grade, subject)
      .then((r) => setTopics(r.topics))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }, [grade, subject]);

  async function handlePickTopic(topic: string) {
    if (!grade) return;
    setGeneratingTopic(topic);
    try {
      const generated = await getCurriculumLesson(grade, subject, topic);
      const subjectRecord = await findOrCreateSubject(subject);
      const lessonId = generateId();
      const lesson = await createLesson({
        id: lessonId,
        subjectId: subjectRecord.id,
        title: generated.title,
        photoIds: [],
        extractedText: generated.extractedText,
      });
      await saveQuizSet(
        lesson.id,
        generated.qcm,
        generated.flashcards,
        generated.lessonCards,
        generated.exercises
      );
      navigate(`/lecon/${lesson.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      alert(`Échec de la génération : ${message}`);
    } finally {
      setGeneratingTopic(null);
    }
  }

  if (generatingTopic) {
    return (
      <div className="screen">
        <Header title={subject} />
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-text">Préparation de la leçon "{generatingTopic}"...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={subject} />
      <div className="content">
        {error ? (
          <p className="hint">{error}</p>
        ) : !topics ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-text">Chargement des chapitres...</p>
          </div>
        ) : (
          <div className="card-list">
            {topics.map((topic, i) => (
              <button
                key={topic}
                className="topic-card"
                onClick={() => handlePickTopic(topic)}
              >
                <span className="topic-number">{i + 1}</span>
                <div className="card-text">
                  <p className="card-name">{topic}</p>
                </div>
                <span className="chevron">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
