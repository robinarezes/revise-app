import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Header } from "../components/Header";
import { getDailyQuizResult, saveDailyQuizResult, type DailyQuizResultRow } from "../db/db";
import { useProfile } from "../ProfileContext";
import { BackendError } from "../services/backendClient";
import { getDailyQuiz } from "../services/dailyQuiz";
import { playCorrect, playComplete, playWrong } from "../services/sound";
import type { QcmQuestion } from "../types";

const BASE_POINTS = 10;
const MAX_SPEED_BONUS = 10;

// Barème : réponse juste = 10 points + un bonus de vitesse qui descend de 1
// point par seconde écoulée sur cette question (jusqu'à 0). Pas de minuteur
// qui coupe la partie : on peut toujours répondre, juste avec moins de bonus.
function pointsForAnswer(correct: boolean, secondsTaken: number): number {
  if (!correct) return 0;
  const bonus = Math.max(0, MAX_SPEED_BONUS - Math.floor(secondsTaken));
  return BASE_POINTS + bonus;
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyQuizPage() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, addXp, recordActivity } = useProfile();
  const [questions, setQuestions] = useState<QcmQuestion[] | null>(null);
  const [alreadyDone, setAlreadyDone] = useState<DailyQuizResultRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const quizStartRef = useRef<number | null>(null);
  const questionStartRef = useRef<number | null>(null);

  useEffect(() => {
    getDailyQuizResult(subjectName, todayStr()).then((r) => setAlreadyDone(r ?? null));
  }, [subjectName]);

  useEffect(() => {
    if (!profile?.grade || alreadyDone !== null) return;
    getDailyQuiz(profile.grade, subjectName)
      .then((r) => setQuestions(r.qcm))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Erreur inconnue.");
        setNeedsReauth(e instanceof BackendError && e.code === "unauthenticated");
      });
  }, [profile?.grade, subjectName, alreadyDone]);

  // Chrono qui compte le temps total de la partie, sans limite.
  useEffect(() => {
    if (!questions || finished) return;
    if (quizStartRef.current === null) quizStartRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (quizStartRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [questions, finished]);

  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [index]);

  function handleSelect(optionIndex: number) {
    if (selected !== null || !questions) return;
    setSelected(optionIndex);
    const secondsTaken = (Date.now() - (questionStartRef.current ?? Date.now())) / 1000;
    const correct = optionIndex === questions[index].correctIndex;
    const points = pointsForAnswer(correct, secondsTaken);
    if (correct) {
      setCorrectCount((c) => c + 1);
      addXp(points);
      playCorrect();
    } else {
      playWrong();
    }
    setTotalPoints((p) => p + points);
  }

  function handleNext() {
    if (!questions) return;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      recordActivity();
      saveDailyQuizResult(subjectName, todayStr(), correctCount, questions.length, totalPoints).catch(
        () => {}
      );
      setFinished(true);
      playComplete();
    }
  }

  if (alreadyDone === undefined) {
    return <div className="screen" />;
  }

  if (alreadyDone) {
    const ratio = alreadyDone.score / alreadyDone.total;
    return (
      <div className="screen">
        <Header title={`Quiz du jour · ${subjectName}`} />
        <div className="content-center">
          <span className="celebrate-emoji">{ratio >= 0.8 ? "🎉" : ratio >= 0.5 ? "👍" : "💪"}</span>
          <p className="title-md">Déjà fait aujourd'hui !</p>
          <p className="score-text">
            {alreadyDone.score} / {alreadyDone.total}
          </p>
          <p className="score-label">bonnes réponses</p>
          <span className="xp-earned">⭐ +{alreadyDone.xpEarned} XP</span>
          <p className="hint">Reviens demain pour un nouveau quiz.</p>

          <button className="btn btn-secondary btn-block" onClick={() => navigate("/")}>
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    );
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
    const ratio = correctCount / questions.length;
    return (
      <div className="screen">
        <Header title="Résultat" />
        <div className="content-center">
          <span className="celebrate-emoji">{ratio >= 0.8 ? "🎉" : ratio >= 0.5 ? "👍" : "💪"}</span>
          <p className="score-text">
            {correctCount} / {questions.length}
          </p>
          <p className="score-label">bonnes réponses en {formatElapsed(elapsed)}</p>
          <span className="xp-earned">🏆 +{totalPoints} points</span>
          <p className="hint">Retrouve ton rang dans l'onglet Classement.</p>

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
      <Header title={`Quiz du jour · ${subjectName}`} showBack={false} />
      <div className="quiz-progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="hearts">⏱ {formatElapsed(elapsed)}</span>
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
