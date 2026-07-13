import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { NotFoundScreen } from "../components/NotFoundScreen";
import { getQuizSet } from "../db/db";
import { useProfile } from "../ProfileContext";
import { triggerConfetti } from "../services/confetti";
import { clearProgress, loadProgress, saveProgress } from "../services/quizProgress";
import { playCorrect, playComplete, playWrong } from "../services/sound";
import type { QcmQuestion } from "../types";

const XP_PER_CORRECT = 5;
const MAX_HEARTS = 5;

type SavedProgress = {
  queue: QcmQuestion[];
  index: number;
  correctCount: number;
  wrongQuestions: QcmQuestion[];
};

export default function QcmPage() {
  const { leconId = "" } = useParams();
  const navigate = useNavigate();
  const { addXp, recordActivity } = useProfile();
  const progressKey = `qcm:${leconId}`;
  const [allQuestions, setAllQuestions] = useState<QcmQuestion[]>([]);
  const [queue, setQueue] = useState<QcmQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<QcmQuestion[]>([]);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuizSet(leconId).then((quizSet) => {
      setLoading(false);
      if (!quizSet) return;
      setAllQuestions(quizSet.qcm);
      const saved = loadProgress<SavedProgress>(progressKey);
      if (saved && saved.queue.length > 0) {
        setQueue(saved.queue);
        setIndex(saved.index);
        setCorrectCount(saved.correctCount);
        setWrongQuestions(saved.wrongQuestions);
      } else {
        resetRun(quizSet.qcm);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leconId]);

  useEffect(() => {
    if (queue.length === 0 || finished) return;
    saveProgress<SavedProgress>(progressKey, { queue, index, correctCount, wrongQuestions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, index, correctCount, wrongQuestions, finished]);

  function resetRun(questions: QcmQuestion[]) {
    setQueue(questions);
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setWrongQuestions([]);
    setFinished(false);
  }

  function handleSelect(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    const question = queue[index];
    if (optionIndex === question.correctIndex) {
      setCorrectCount((c) => c + 1);
      addXp(XP_PER_CORRECT);
      playCorrect();
    } else {
      setWrongQuestions((w) => [...w, question]);
      playWrong();
    }
  }

  function handleNext() {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      recordActivity();
      setFinished(true);
      clearProgress(progressKey);
      playComplete();
      if (wrongQuestions.length === 0) triggerConfetti();
    }
  }

  if (loading) return <div className="screen" />;
  if (queue.length === 0) {
    return <NotFoundScreen title="QCM" message="Ce quiz n'existe plus ou a été supprimé." />;
  }

  if (finished) {
    const xpEarned = correctCount * XP_PER_CORRECT;
    const ratio = correctCount / queue.length;
    return (
      <div className="screen">
        <Header title="Résultat" />
        <div className="content-center">
          <span className="celebrate-emoji">{ratio >= 0.8 ? "🎉" : ratio >= 0.5 ? "👍" : "💪"}</span>
          <p className="score-text">
            {correctCount} / {queue.length}
          </p>
          <p className="score-label">bonnes réponses</p>
          <span className="xp-earned">⭐ +{xpEarned} XP</span>

          {wrongQuestions.length > 0 ? (
            <button className="btn btn-primary btn-block" onClick={() => resetRun(wrongQuestions)}>
              Refaire les {wrongQuestions.length} question{wrongQuestions.length > 1 ? "s" : ""}{" "}
              ratée{wrongQuestions.length > 1 ? "s" : ""}
            </button>
          ) : null}

          <button className="btn btn-secondary btn-block" onClick={() => resetRun(allQuestions)}>
            Recommencer depuis le début
          </button>

          <button className="link-btn" onClick={() => navigate(-1)}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  const question = queue[index];
  const heartsLost = Math.min(wrongQuestions.length, MAX_HEARTS);
  const progress = ((index + (selected !== null ? 1 : 0)) / queue.length) * 100;

  return (
    <div className="screen">
      <Header title={`Question ${index + 1}/${queue.length}`} />
      <div className="quiz-progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="hearts">
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <span key={i} className={i < heartsLost ? "heart-lost" : ""}>
              ❤️
            </span>
          ))}
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
            {index + 1 < queue.length ? "Suivant" : "Voir le résultat"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
