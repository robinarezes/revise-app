import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Header } from "../components/Header";
import { useProfile } from "../ProfileContext";
import { BackendError } from "../services/backendClient";
import { triggerConfetti } from "../services/confetti";
import { getCurriculumTopics } from "../services/curriculum";
import { getGeneralQuiz, type Difficulty } from "../services/generalQuiz";
import { getPersonalBest, reportScore } from "../services/personalBest";
import { playCorrect, playComplete, playWrong } from "../services/sound";
import type { QcmQuestion } from "../types";

const XP_PER_CORRECT = 4;
const PERFECT_BONUS = 10;
const SPECIAL_SUBJECTS = ["toutes les matières", "toutes les matieres", "culture générale", "culture generale"];

type Scope = "tout" | "chapitres" | null;

export default function GeneralQuizPage() {
  const { subject = "" } = useParams();
  const subjectName = decodeURIComponent(subject);
  const [searchParams] = useSearchParams();
  const difficulty = (searchParams.get("difficulty") as Difficulty | null) ?? "moyen";
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, addXp, recordActivity } = useProfile();

  const isChapterable = !subjectName.includes(",") && !SPECIAL_SUBJECTS.includes(subjectName.toLowerCase());
  const [scope, setScope] = useState<Scope>(isChapterable ? null : "tout");
  const [availableTopics, setAvailableTopics] = useState<string[] | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QcmQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const personalBest = getPersonalBest(subjectName);

  const loadQuiz = useCallback(() => {
    if (!profile?.grade || scope === null) return;
    setQuestions(null);
    setError(null);
    setNeedsReauth(false);
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setFinished(false);
    setIsNewBest(false);
    getGeneralQuiz(profile.grade, subjectName, {
      topics: scope === "chapitres" ? selectedTopics : undefined,
      difficulty,
    })
      .then((r) => setQuestions(r.qcm))
      .catch((e) => {
        if (e instanceof BackendError && e.code === "quota_exceeded") {
          navigate("/premium?raison=quota");
          return;
        }
        setError(e instanceof Error ? e.message : "Erreur inconnue.");
        setNeedsReauth(e instanceof BackendError && e.code === "unauthenticated");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.grade, subjectName, navigate, scope, difficulty]);

  useEffect(() => {
    if (scope === null) return;
    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.grade, subjectName, scope]);

  function handlePickChapitres() {
    if (!profile?.grade) return;
    setTopicsError(null);
    getCurriculumTopics(profile.grade, subjectName)
      .then((r) => setAvailableTopics(r.topics))
      .catch((e) => setTopicsError(e instanceof Error ? e.message : "Erreur inconnue."));
  }

  function toggleTopic(topic: string) {
    setSelectedTopics((t) => (t.includes(topic) ? t.filter((x) => x !== topic) : [...t, topic]));
  }

  function handleSelect(optionIndex: number) {
    if (selected !== null || !questions) return;
    setSelected(optionIndex);
    if (optionIndex === questions[index].correctIndex) {
      setCorrectCount((c) => c + 1);
      addXp(XP_PER_CORRECT);
      playCorrect();
    } else {
      playWrong();
    }
  }

  function handleNext() {
    if (!questions) return;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(null);
    } else {
      recordActivity();
      if (correctCount === questions.length) {
        addXp(PERFECT_BONUS);
      }
      setFinished(true);
      playComplete();
      if (reportScore(subjectName, correctCount)) {
        setIsNewBest(true);
        triggerConfetti();
      }
    }
  }

  // Étape intermédiaire pour une matière précise : tout le programme, ou
  // seulement certains chapitres.
  if (scope === null) {
    return (
      <div className="screen">
        <Header title={`Quiz général · ${subjectName}`} />
        <div className="content">
          {!availableTopics ? (
            <>
              <p className="hint">Sur quoi veux-tu être interrogé ?</p>
              <button className="mode-btn" onClick={() => setScope("tout")}>
                <p className="mode-btn-title">📘 Tout le programme</p>
                <p className="mode-btn-subtitle">Des questions sur l'ensemble de la matière</p>
              </button>
              <button className="mode-btn" onClick={handlePickChapitres}>
                <p className="mode-btn-title">🔖 Choisir des chapitres</p>
                <p className="mode-btn-subtitle">Sélectionne uniquement ce que tu veux réviser</p>
              </button>
              {topicsError ? <p className="hint">{topicsError}</p> : null}
            </>
          ) : (
            <>
              <p className="hint">Sélectionne les chapitres à réviser.</p>
              <div className="card-list">
                {availableTopics.map((topic) => (
                  <button
                    key={topic}
                    className={`topic-card ${selectedTopics.includes(topic) ? "option-pill-selected" : ""}`}
                    onClick={() => toggleTopic(topic)}
                  >
                    <div className="card-text">
                      <p className="card-name">{topic}</p>
                    </div>
                    <span className="chevron">{selectedTopics.includes(topic) ? "✅" : ""}</span>
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary btn-block"
                disabled={selectedTopics.length === 0}
                onClick={() => setScope("chapitres")}
              >
                Lancer ({selectedTopics.length} chapitre{selectedTopics.length > 1 ? "s" : ""})
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="screen">
        <Header title={`Quiz général · ${subjectName}`} />
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
        <Header title={`Quiz général · ${subjectName}`} />
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-text">Préparation du quiz...</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const perfect = correctCount === questions.length;
    const xpEarned = correctCount * XP_PER_CORRECT + (perfect ? PERFECT_BONUS : 0);
    const ratio = correctCount / questions.length;
    return (
      <div className="screen">
        <Header title="Résultat" />
        <div className="content-center">
          <span className="celebrate-emoji">
            {isNewBest ? "🏆" : perfect ? "🏆" : ratio >= 0.5 ? "👍" : "💪"}
          </span>
          <p className="score-text">
            {correctCount} / {questions.length}
          </p>
          <p className="score-label">bonnes réponses</p>
          <span className="xp-earned">⭐ +{xpEarned} XP{perfect ? " (score parfait !)" : ""}</span>
          {isNewBest ? (
            <p className="hint" style={{ color: "var(--success)", fontWeight: 800 }}>
              🎉 Nouveau record personnel !
            </p>
          ) : (
            <p className="hint">Ton record : {personalBest} / {questions.length}</p>
          )}

          <button className="btn btn-primary btn-block" onClick={loadQuiz}>
            🔄 Rejouer (encore des points !)
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate("/")}>
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
      <Header title={`Quiz général · ${subjectName}`} />
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
