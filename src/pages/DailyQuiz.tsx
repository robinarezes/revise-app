import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Header } from "../components/Header";
import { useProfile } from "../ProfileContext";
import { BackendError } from "../services/backendClient";
import { getDailyQuiz } from "../services/dailyQuiz";
import type { QcmQuestion } from "../types";

const XP_PER_CORRECT = 3;

export default function DailyQuizPage() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, addXp, recordActivity } = useProfile();
  const [questions, setQuestions] = useState<QcmQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!profile?.grade) return;
    getDailyQuiz(profile.grade, subjectName)
      .then((r) => setQuestions(r.qcm))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Erreur inconnue.");
        setNeedsReauth(e instanceof BackendError && e.code === "unauthenticated");
      });
  }, [profile?.grade, subjectName]);

  function handleSelect(optionIndex: number) {
    if (selected !== null || !questions) return;
    setSelected(optionIndex);
    if (optionIndex === questions[index].correctIndex) {
      setCorrectCount((c) => c + 1);
      addXp(XP_PER_CORRECT);
    }
  }

  function handleNext() {
    if (!questions) return;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      recordActivity();
      setFinished(true);
    }
  }

  if (error) {
    return (
      <div className="screen">
        <Header title={`Quiz du jour · ${subjectName}`} />
        <div className="content-center">
          <p className="hint">{error}</p>
          {needsReauth ? (
            <button className="btn btn-primary btn-block" onClick={() => signOut()}>
              Se connecter
            </button>
          ) : (
            <button className="btn btn-secondary btn-block" onClick={() => navigate("/")}>
              🏠 Retour à l'accueil
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="screen">
        <Header title={`Quiz du jour · ${subjectName}`} />
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-text">Préparation du quiz du jour...</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const xpEarned = correctCount * XP_PER_CORRECT;
    const ratio = correctCount / questions.length;
    return (
      <div className="screen">
        <Header title="Résultat" />
        <div className="content-center">
          <span className="celebrate-emoji">{ratio >= 0.8 ? "🎉" : ratio >= 0.5 ? "👍" : "💪"}</span>
          <p className="score-text">
            {correctCount} / {questions.length}
          </p>
          <p className="score-label">bonnes réponses</p>
          <span className="xp-earned">⭐ +{xpEarned} XP</span>

          <button className="btn btn-primary btn-block" onClick={() => navigate("/")}>
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  const question = questions[index];
  const progress = ((index + (selected !== null ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="screen">
      <Header title={`Quiz du jour · ${subjectName}`} />
      <div className="quiz-progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="content">
        <p className="question-text">{question.question}</p>

        <div className="options">
          {question.options.map((option, i) => {
            const isCorrect = i === question.correctIndex;
            const isSelected = i === selected;
            const showFeedback = selected !== null;
            const className = [
              "option",
              showFeedback && isCorrect ? "option-correct" : "",
              showFeedback && isSelected && !isCorrect ? "option-wrong" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={i}
                className={className}
                onClick={() => handleSelect(i)}
                disabled={showFeedback}
              >
                {option}
              </button>
            );
          })}
        </div>

        {selected !== null && question.explanation ? (
          <p className="explanation">{question.explanation}</p>
        ) : null}

        <div className="spacer" />

        {selected !== null ? (
          <button className="btn btn-primary" onClick={handleNext}>
            {index + 1 < questions.length ? "Suivant" : "Voir le résultat"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
