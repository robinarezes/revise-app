import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Header } from "../components/Header";
import { NotFoundScreen } from "../components/NotFoundScreen";
import {
  deleteClass,
  getClass,
  getClassFeed,
  getClassMembers,
  getFriendData,
  getLessons,
  inviteFriendToClass,
  leaveClass,
  removeClassMember,
  shareLessonToClass,
} from "../db/db";
import type { ClassMember, FriendEntry, Lesson, SchoolClass, SharedLesson } from "../types";

export default function ClassDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const myUserId = session?.user.id;

  const [schoolClass, setSchoolClass] = useState<SchoolClass | null | undefined>(undefined);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [feed, setFeed] = useState<SharedLesson[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [myLessons, setMyLessons] = useState<Lesson[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    getClassMembers(id).then(setMembers).catch(() => {});
    getClassFeed(id).then(setFeed).catch(() => {});
  }

  useEffect(() => {
    getClass(id).then((c) => setSchoolClass(c ?? null));
    getFriendData()
      .then((entries) => setFriends(entries.filter((e) => e.relation === "friend")))
      .catch(() => {});
    getLessons()
      .then(setMyLessons)
      .catch(() => {});
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isOwner = !!myUserId && schoolClass?.ownerId === myUserId;
  const memberIds = new Set(members.map((m) => m.userId));
  const invitableFriends = friends.filter((f) => !memberIds.has(f.userId));
  const sharedLessonIds = new Set(feed.map((f) => f.lessonId));
  const shareableLessons = myLessons.filter((l) => !sharedLessonIds.has(l.id));

  async function handleInvite(userId: string) {
    setError(null);
    try {
      await inviteFriendToClass(id, userId);
      setShowInvite(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  async function handleShare(lessonId: string) {
    setError(null);
    try {
      await shareLessonToClass(id, lessonId);
      setShowShare(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Retirer ce membre de la classe ?")) return;
    setError(null);
    try {
      await removeClassMember(id, userId);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  async function handleLeaveOrDelete() {
    if (isOwner) {
      if (!confirm("Supprimer cette classe ? Elle sera retirée pour tous les membres.")) return;
      await deleteClass(id);
    } else {
      if (!confirm("Quitter cette classe ?")) return;
      await leaveClass(id);
    }
    navigate("/classes");
  }

  if (schoolClass === null) {
    return <NotFoundScreen title="Classe" message="Cette classe n'existe plus ou tu n'y as pas accès." />;
  }
  if (schoolClass === undefined) return <div className="screen" />;

  return (
    <div className="screen">
      <Header title={schoolClass.name} />
      <div className="content">
        {error ? (
          <p className="hint" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        <div className="actions-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <p className="section-label" style={{ margin: 0 }}>
            Membres ({members.length})
          </p>
          {isOwner ? (
            <button className="link-btn" onClick={() => setShowInvite((v) => !v)}>
              + Inviter un ami
            </button>
          ) : null}
        </div>
        <div className="card-list">
          {members.map((m) => (
            <div key={m.userId} className="topic-card">
              <div className="card-text">
                <p className="card-name">
                  {m.username}
                  {m.userId === myUserId ? " (toi)" : ""}
                </p>
              </div>
              {isOwner && m.userId !== myUserId ? (
                <button className="link-btn" onClick={() => handleRemoveMember(m.userId)}>
                  Retirer
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {showInvite ? (
          <>
            <p className="section-label" style={{ marginTop: 12 }}>
              Inviter parmi tes amis
            </p>
            {invitableFriends.length === 0 ? (
              <p className="hint">
                Tous tes amis sont déjà dans cette classe, ou tu n'as pas encore d'ami. Va sur la
                page Amis pour en ajouter.
              </p>
            ) : (
              <div className="card-list">
                {invitableFriends.map((f) => (
                  <div key={f.userId} className="topic-card">
                    <div className="card-text">
                      <p className="card-name">{f.username}</p>
                    </div>
                    <button className="link-btn" onClick={() => handleInvite(f.userId)}>
                      Inviter
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        <div className="actions-row" style={{ alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
          <p className="section-label" style={{ margin: 0 }}>
            Leçons partagées
          </p>
          <button className="link-btn" onClick={() => setShowShare((v) => !v)}>
            + Partager une leçon
          </button>
        </div>

        {showShare ? (
          shareableLessons.length === 0 ? (
            <p className="hint">
              {myLessons.length === 0
                ? "Tu n'as pas encore de leçon à partager."
                : "Toutes tes leçons sont déjà partagées dans cette classe."}
            </p>
          ) : (
            <div className="card-list">
              {shareableLessons.map((l) => (
                <div key={l.id} className="topic-card">
                  <div className="card-text">
                    <p className="card-name">{l.title}</p>
                  </div>
                  <button className="link-btn" onClick={() => handleShare(l.id)}>
                    Partager
                  </button>
                </div>
              ))}
            </div>
          )
        ) : null}

        {feed.length === 0 ? (
          <p className="hint">Personne n'a encore partagé de leçon dans cette classe.</p>
        ) : (
          <div className="card-list">
            {feed.map((s) => (
              <button
                key={s.id}
                className="topic-card"
                onClick={() => navigate(`/lecon/${s.lessonId}`)}
              >
                <div className="card-text">
                  <p className="card-name">{s.lessonTitle}</p>
                  <p className="hint" style={{ margin: 0 }}>
                    {s.subjectName} · partagé par {s.sharedByUsername}
                  </p>
                </div>
                <span className="chevron">›</span>
              </button>
            ))}
          </div>
        )}

        <button className="link-btn-danger" style={{ marginTop: 20 }} onClick={handleLeaveOrDelete}>
          {isOwner ? "Supprimer la classe" : "Quitter la classe"}
        </button>
      </div>
    </div>
  );
}
