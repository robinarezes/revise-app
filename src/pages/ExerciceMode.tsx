import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { getQuizSet } from "../db/db";
import { useProfile } from "../ProfileContext";
import { correctAnswer, type Correction } from "../services/correctAnswer";
import type { ExerciseQuestion } from "../types";

const XP_BY_VERDICT: Record<Correction["verdict"], number> = {
  correct: 8,
  partiel: 4,
  incorrect: 0,
};

const VERDICT_LABEL: Record<Correction["verdict"], string> = {
  correct: "✅ Correct",
  partiel: "🟡 Partiellement correct",
  incorrect: "❌ Incorrect",
};

export default function ExercicePage() {
  const { leconId = "" } = useParams();
  const navigate = useNavigate();
  const { addXp, recordActivity } = useProfile();
  const [exercises, setExercises] = useState<ExerciseQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [results, setResults] = useState<Correction["verdict"][]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    getQuizSet(leconId).then((quizSet) => {
      if (!quizSet) return;
      setExercises(quizSet.exercises);
    });
  }, [leconId]);

  async function handleSubmit() {
    setCorrecting(true);
    try {
      const result = await correctAnswer({
        question: exercises[index].question,
        idealAnswer: exercises[index].idealAnswer,
        userAnswer: answer,
      });
      setCorrection(result);
      setResults((r) => [...r, result.verdict]);
      addXp(XP_BY_VERDICT[result.verdict]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      alert(`Échec de la correction : ${message}`);
    } finally {
      setCorrecting(false);
    }
  }

  function handleNext() {
    if (index + 1 < exercises.length) {
      setIndex(index + 1);
      setAnswer("");
      setCorrection(null);
    } else {
      recordActivity();
      setFinished(true);
    }
  }

  function restart() {
    setIndex(0);
    setAnswer("");
    setCorrection(null);
    setResults([]);
    setFinished(false);
  }

  if (exercises.length === 0) return <div className="screen" />;

  if (finished) {
    const correctCount = results.filter((v) => v === "correct").length;
    const xpEarned = results.reduce((sum, v) => sum + XP_BY_VERDICT[v], 0);
    const ratio = correctCount / exercises.length;
    return (
      <div className="screen">
        <Header title="Résultat" />
        <div className="content-center">
          <span className="celebrate-emoji">{ratio >= 0.8 ? "🎉" : ratio >= 0.5 ? "👍" : "💪"}</span>
          <p className="score-text">
            {correctCount} / {exercises.length}
          </p>
          <p className="score-label">réponses correctes</p>
          <span className="xp-earned">⭐ +{xpEarned} XP</span>

          <button className="btn btn-primary btn-block" onClick={restart}>
            Recommencer les exercices
          </button>
          <button className="link-btn" onClick={() => navigate(-1)}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  const exercise = exercises[index];
  const progress = (index / exercises.length) * 100;

  return (
    <div className="screen">
      <Header title={`Exercice ${index + 1}/${exercises.length}`} />
      <div className="quiz-progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="content">
        <p className="question-text">{exercise.question}</p>

        <textarea
          className="answer-textarea"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Écris ta réponse ici..."
          disabled={correction !== null || correcting}
          rows={5}
        />

        {correction ? (
          <div className={`verdict-box verdict-${correction.verdict}`}>
            <p className="verdict-label">{VERDICT_LABEL[correction.verdict]}</p>
            <p className="verdict-feedback">{correction.feedback}</p>
            {correction.verdict !== "correct" ? (
              <p className="verdict-ideal">
                <strong>Réponse attendue :</strong> {exercise.idealAnswer}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="spacer" />

        {correction ? (
          <button className="btn btn-primary" onClick={handleNext}>
            {index + 1 < exercises.length ? "Suivant" : "Voir le résultat"}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={correcting || !answer.trim()}
          >
            {correcting ? "Correction en cours..." : "Valider"}
          </button>
        )}
      </div>
    </div>
  );
}
