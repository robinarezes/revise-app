import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { NotFoundScreen } from "../components/NotFoundScreen";
import { SpeakButton } from "../components/SpeakButton";
import { getQuizSet } from "../db/db";
import { useProfile } from "../ProfileContext";
import type { LessonCard } from "../types";

const XP_FOR_COMPLETING = 5;

export default function LeconModePage() {
  const { leconId = "" } = useParams();
  const navigate = useNavigate();
  const { addXp, recordActivity } = useProfile();
  const [cards, setCards] = useState<LessonCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuizSet(leconId).then((quizSet) => {
      setLoading(false);
      if (!quizSet) return;
      setCards(quizSet.lessonCards);
    });
  }, [leconId]);

  function handleNext() {
    if (index + 1 < cards.length) {
      setIndex(index + 1);
      setFlipped(false);
    } else {
      recordActivity();
      addXp(XP_FOR_COMPLETING);
      setFinished(true);
    }
  }

  function restart() {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
  }

  if (loading) return <div className="screen" />;
  if (cards.length === 0) {
    return <NotFoundScreen title="Leçon" message="Cette leçon n'existe plus ou a été supprimée." />;
  }

  if (finished) {
    return (
      <div className="screen">
        <Header title="Leçon" />
        <div className="content-center">
          <span className="celebrate-emoji">📖</span>
          <p className="title-md">Leçon terminée !</p>
          <p className="subtitle">Tu as revu les {cards.length} notions de cette leçon.</p>
          <span className="xp-earned">⭐ +{XP_FOR_COMPLETING} XP</span>

          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/revision/${leconId}/qcm`)}
          >
            Tester avec un QCM
          </button>
          <button className="btn btn-secondary btn-block" onClick={restart}>
            Revoir la leçon
          </button>
          <button className="link-btn" onClick={() => navigate(-1)}>
            Terminer
          </button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  const progress = ((index + (flipped ? 1 : 0)) / cards.length) * 100;

  return (
    <div className="screen">
      <Header title={`Notion ${index + 1}/${cards.length}`} />
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
              <span className="flash-card-label">Notion</span>
              <p className="flash-card-text">{card.concept}</p>
              <span className="flash-card-hint">Touche la carte pour voir l'explication</span>
            </div>
            <div className="flip-card-face flip-card-back">
              <span className="flash-card-label">Explication</span>
              <p className="flash-card-text">{card.explanation}</p>
            </div>
          </div>
        </div>

        <SpeakButton text={flipped ? card.explanation : card.concept} />

        <div className="spacer" />

        <button className="btn btn-primary" onClick={handleNext}>
          {index + 1 < cards.length ? "Suivant" : "Terminer la leçon"}
        </button>
      </div>
    </div>
  );
}
