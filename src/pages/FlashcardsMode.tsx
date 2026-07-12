import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { getQuizSet } from "../db/db";
import { useProfile } from "../ProfileContext";
import type { FlashCard } from "../types";

const XP_PER_KNOWN = 2;

export default function FlashcardsPage() {
  const { leconId = "" } = useParams();
  const navigate = useNavigate();
  const { addXp, recordActivity } = useProfile();
  const [allCards, setAllCards] = useState<FlashCard[]>([]);
  const [queue, setQueue] = useState<FlashCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [toRevisit, setToRevisit] = useState<FlashCard[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    getQuizSet(leconId).then((quizSet) => {
      if (!quizSet) return;
      setAllCards(quizSet.flashcards);
      resetRun(quizSet.flashcards);
    });
  }, [leconId]);

  function resetRun(cards: FlashCard[]) {
    setQueue(cards);
    setIndex(0);
    setFlipped(false);
    setKnownCount(0);
    setToRevisit([]);
    setFinished(false);
  }

  function handleAnswer(known: boolean) {
    const card = queue[index];
    if (known) {
      setKnownCount((c) => c + 1);
      addXp(XP_PER_KNOWN);
    } else {
      setToRevisit((r) => [...r, card]);
    }
    if (index + 1 < queue.length) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      recordActivity();
      setFinished(true);
    }
  }

  if (queue.length === 0) return <div className="screen" />;

  if (finished) {
    const xpEarned = knownCount * XP_PER_KNOWN;
    const ratio = knownCount / queue.length;
    return (
      <div className="screen">
        <Header title="Résultat" />
        <div className="content-center">
          <span className="celebrate-emoji">{ratio >= 0.8 ? "🎉" : ratio >= 0.5 ? "👍" : "💪"}</span>
          <p className="score-text">
            {knownCount} / {queue.length}
          </p>
          <p className="score-label">cartes sues</p>
          <span className="xp-earned">⭐ +{xpEarned} XP</span>

          {toRevisit.length > 0 ? (
            <button className="btn btn-primary btn-block" onClick={() => resetRun(toRevisit)}>
              Revoir les {toRevisit.length} carte{toRevisit.length > 1 ? "s" : ""} restante
              {toRevisit.length > 1 ? "s" : ""}
            </button>
          ) : null}

          <button className="btn btn-secondary btn-block" onClick={() => resetRun(allCards)}>
            Recommencer depuis le début
          </button>

          <button className="link-btn" onClick={() => navigate(-1)}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  const card = queue[index];
  const progress = ((index + (flipped ? 1 : 0)) / queue.length) * 100;

  return (
    <div className="screen">
      <Header title={`Carte ${index + 1}/${queue.length}`} />
      <div className="quiz-progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="content">
        <div
          className={`flip-card ${flipped ? "flipped" : ""}`}
          onClick={() => setFlipped((f) => !f)}
        >
          <div className="flip-card-inner">
            <div className="flip-card-face">
              <span className="flash-card-label">Question</span>
              <p className="flash-card-text">{card.question}</p>
              <span className="flash-card-hint">Touche la carte pour voir la réponse</span>
            </div>
            <div className="flip-card-face flip-card-back">
              <span className="flash-card-label">Réponse</span>
              <p className="flash-card-text">{card.answer}</p>
            </div>
          </div>
        </div>

        {flipped ? (
          <div className="answer-row">
            <button className="know-btn know-btn-no" onClick={() => handleAnswer(false)}>
              À revoir
            </button>
            <button className="know-btn know-btn-yes" onClick={() => handleAnswer(true)}>
              Je savais
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
