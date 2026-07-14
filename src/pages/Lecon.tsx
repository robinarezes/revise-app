import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Header } from "../components/Header";
import { HighlightedText } from "../components/HighlightedText";
import { NotFoundScreen } from "../components/NotFoundScreen";
import { PhotoImage } from "../components/PhotoImage";
import { SpeakButton } from "../components/SpeakButton";
import {
  deleteLesson,
  getFriendData,
  getLesson,
  getMyClasses,
  saveSimplifiedText,
  saveSummaryText,
  shareLessonToClass,
  shareLessonToFriend,
} from "../db/db";
import { useProfile } from "../ProfileContext";
import { simplifyLesson } from "../services/simplifyLesson";
import { summarizeLesson } from "../services/summarizeLesson";
import type { FriendEntry, Lesson, SchoolClass } from "../types";

export default function LeconPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { profile, isAdultMode } = useProfile();
  const [lesson, setLesson] = useState<Lesson | undefined>();
  const [notFound, setNotFound] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [simplifyError, setSimplifyError] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [myClasses, setMyClasses] = useState<SchoolClass[] | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharedTo, setSharedTo] = useState<Set<string>>(new Set());
  const [showFriendShare, setShowFriendShare] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[] | null>(null);
  const [friendShareError, setFriendShareError] = useState<string | null>(null);
  const [sharedToFriends, setSharedToFriends] = useState<Set<string>>(new Set());
  const xpEarned = (location.state as { xpEarned?: number } | null)?.xpEarned;
  const dyslexiaMode = profile?.dyslexia_mode ?? false;
  const isOwner = !!session?.user.id && lesson?.ownerId === session.user.id;

  useEffect(() => {
    getLesson(id).then((l) => {
      setLesson(l);
      if (!l) setNotFound(true);
    });
  }, [id]);

  // Résumé très court affiché par défaut (la leçon complète reste
  // disponible via "Développer la leçon"), généré une seule fois par leçon.
  useEffect(() => {
    if (!lesson || lesson.summaryText) return;
    let cancelled = false;
    setSummarizing(true);
    setSummaryError(null);
    summarizeLesson({ lessonTitle: lesson.title, lessonText: lesson.extractedText })
      .then(async (result) => {
        await saveSummaryText(lesson.id, result.summaryText);
        if (!cancelled) {
          setLesson((l) => (l ? { ...l, summaryText: result.summaryText } : l));
        }
      })
      .catch((e) => {
        // Le contenu complet reste affiché dans tous les cas ; on garde
        // juste l'erreur pour proposer un nouvel essai plutôt que de
        // laisser l'élève sans explication ni recours.
        if (!cancelled) setSummaryError(e instanceof Error ? e.message : "Erreur inconnue.");
      })
      .finally(() => {
        if (!cancelled) setSummarizing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson?.id, lesson?.summaryText, summaryAttempt]);

  useEffect(() => {
    if (!lesson || !dyslexiaMode || lesson.simplifiedText) return;
    let cancelled = false;
    setSimplifying(true);
    setSimplifyError(null);
    simplifyLesson({ lessonTitle: lesson.title, lessonText: lesson.extractedText })
      .then(async (result) => {
        await saveSimplifiedText(lesson.id, result.simplifiedText);
        if (!cancelled) {
          setLesson((l) => (l ? { ...l, simplifiedText: result.simplifiedText } : l));
        }
      })
      .catch((e) => {
        if (!cancelled) setSimplifyError(e instanceof Error ? e.message : "Erreur inconnue.");
      })
      .finally(() => {
        if (!cancelled) setSimplifying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lesson?.id, lesson?.simplifiedText, dyslexiaMode]);

  async function handleDelete() {
    if (!confirm("Supprimer cette leçon ? Les photos et le quiz associés seront supprimés.")) return;
    await deleteLesson(id);
    navigate(-1);
  }

  function handleOpenShare() {
    setShareError(null);
    setShowShare((v) => !v);
    if (myClasses === null) {
      getMyClasses()
        .then(setMyClasses)
        .catch((e) => setShareError(e instanceof Error ? e.message : "Erreur inconnue."));
    }
  }

  async function handleShareToClass(classId: string) {
    setShareError(null);
    try {
      await shareLessonToClass(classId, id);
      setSharedTo((s) => new Set(s).add(classId));
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  function handleOpenFriendShare() {
    setFriendShareError(null);
    setShowFriendShare((v) => !v);
    if (friends === null) {
      getFriendData()
        .then((entries) => setFriends(entries.filter((e) => e.relation === "friend")))
        .catch((e) => setFriendShareError(e instanceof Error ? e.message : "Erreur inconnue."));
    }
  }

  async function handleShareToFriend(friendUserId: string) {
    setFriendShareError(null);
    try {
      await shareLessonToFriend(friendUserId, id);
      setSharedToFriends((s) => new Set(s).add(friendUserId));
    } catch (e) {
      setFriendShareError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  if (notFound) {
    return (
      <NotFoundScreen
        title="Leçon"
        message="Cette leçon n'existe plus ou a été supprimée."
      />
    );
  }
  if (!lesson) return <div className="screen" />;

  const showSimplified = dyslexiaMode && !!lesson.simplifiedText && !expanded;
  const showSummary = !expanded && !showSimplified && !!lesson.summaryText;
  const displayedText = showSimplified
    ? lesson.simplifiedText!
    : showSummary
      ? lesson.summaryText!
      : lesson.extractedText;

  return (
    <div className="screen">
      <Header title={lesson.title} />
      <div className="content">
        {xpEarned ? (
          <span className="xp-toast">🎉 Leçon ajoutée · +{xpEarned} ⭐ XP</span>
        ) : null}

        <div className="photo-row">
          {lesson.photoIds.map((photoId) => (
            <PhotoImage key={photoId} photoId={photoId} className="photo-large" />
          ))}
        </div>

        <p className="section-label">
          {showSimplified ? "Version simplifiée" : showSummary ? "Résumé" : "Contenu complet"}
        </p>
        {dyslexiaMode && simplifying ? (
          <p className="hint">✨ Simplification de la leçon en cours...</p>
        ) : null}
        {!dyslexiaMode && summarizing && !lesson.summaryText ? (
          <p className="hint">✨ Résumé de la leçon en cours...</p>
        ) : null}
        {!dyslexiaMode && summaryError && !lesson.summaryText ? (
          <p className="hint">
            {summaryError}{" "}
            <button className="link-btn" style={{ padding: 0 }} onClick={() => setSummaryAttempt((n) => n + 1)}>
              Réessayer le résumé
            </button>
          </p>
        ) : null}
        {simplifyError ? <p className="hint">{simplifyError}</p> : null}
        <HighlightedText text={displayedText} />
        {dyslexiaMode ? <SpeakButton text={displayedText} /> : null}

        <div className="actions-row">
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => navigate(`/revision/${lesson.id}`)}
          >
            Réviser cette leçon
          </button>
          {lesson.summaryText ? (
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "📕 Résumer" : "📖 Développer"}
            </button>
          ) : null}
        </div>

        <button className="btn btn-secondary btn-block" onClick={() => navigate("/")}>
          🏠 Retour à l'accueil
        </button>

        {isOwner && !isAdultMode ? (
          <>
            <button className="link-btn" onClick={handleOpenFriendShare}>
              👤 Partager avec un ami
            </button>
            {showFriendShare ? (
              friendShareError ? (
                <p className="hint" style={{ color: "var(--danger)" }}>
                  {friendShareError}
                </p>
              ) : friends === null ? (
                <p className="hint">Chargement...</p>
              ) : friends.length === 0 ? (
                <p className="hint">
                  Tu n'as pas encore d'ami. Ajoutes-en depuis la page Amis (bouton Classe de
                  l'accueil).
                </p>
              ) : (
                <div className="card-list">
                  {friends.map((f) => (
                    <div key={f.userId} className="topic-card">
                      <div className="card-text">
                        <p className="card-name">{f.username}</p>
                      </div>
                      <button
                        className="link-btn"
                        disabled={sharedToFriends.has(f.userId)}
                        onClick={() => handleShareToFriend(f.userId)}
                      >
                        {sharedToFriends.has(f.userId) ? "Partagé ✓" : "Partager"}
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : null}

            <button className="link-btn" onClick={handleOpenShare}>
              🏫 Partager avec une classe
            </button>
            {showShare ? (
              shareError ? (
                <p className="hint" style={{ color: "var(--danger)" }}>
                  {shareError}
                </p>
              ) : myClasses === null ? (
                <p className="hint">Chargement...</p>
              ) : myClasses.length === 0 ? (
                <p className="hint">
                  Tu n'as pas encore de classe. Crée-en une depuis le bouton Classe de l'accueil.
                </p>
              ) : (
                <div className="card-list">
                  {myClasses.map((c) => (
                    <div key={c.id} className="topic-card">
                      <div className="card-text">
                        <p className="card-name">{c.name}</p>
                      </div>
                      <button
                        className="link-btn"
                        disabled={sharedTo.has(c.id)}
                        onClick={() => handleShareToClass(c.id)}
                      >
                        {sharedTo.has(c.id) ? "Partagé ✓" : "Partager"}
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </>
        ) : null}

        {isOwner ? (
          <button className="link-btn-danger" onClick={handleDelete}>
            Supprimer la leçon
          </button>
        ) : null}
      </div>
    </div>
  );
}
