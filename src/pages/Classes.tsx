import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import {
  acceptClassInvitation,
  createClass,
  declineClassInvitation,
  getMyClasses,
  getMyClassInvitations,
} from "../db/db";
import type { ClassInvitation, SchoolClass } from "../types";

export default function ClassesPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [invitations, setInvitations] = useState<ClassInvitation[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    getMyClasses()
      .then(setClasses)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
    getMyClassInvitations()
      .then(setInvitations)
      .catch(() => {});
  }

  useEffect(reload, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createClass(newName);
      setNewName("");
      navigate(`/classes/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAccept(inv: ClassInvitation) {
    setError(null);
    try {
      await acceptClassInvitation(inv.id, inv.classId);
      reload();
      navigate(`/classes/${inv.classId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  async function handleDecline(inv: ClassInvitation) {
    setError(null);
    try {
      await declineClassInvitation(inv.id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  return (
    <div className="screen">
      <Header title="Mes classes" />
      <div className="content">
        {error ? (
          <p className="hint" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        <div className="actions-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <p className="hint" style={{ margin: 0 }}>
            Partage tes leçons avec tes amis dans une classe privée.
          </p>
          <button className="link-btn" onClick={() => navigate("/amis")}>
            👥 Mes amis
          </button>
        </div>

        {invitations.length > 0 ? (
          <>
            <p className="section-label" style={{ marginTop: 20 }}>
              Invitations reçues
            </p>
            <div className="card-list">
              {invitations.map((inv) => (
                <div key={inv.id} className="topic-card">
                  <div className="card-text">
                    <p className="card-name">{inv.className}</p>
                    <p className="hint" style={{ margin: 0 }}>
                      Invité par {inv.fromUsername}
                    </p>
                  </div>
                  <div className="actions-row" style={{ margin: 0 }}>
                    <button className="link-btn" onClick={() => handleAccept(inv)}>
                      ✅
                    </button>
                    <button className="link-btn" onClick={() => handleDecline(inv)}>
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <p className="section-label" style={{ marginTop: 20 }}>
          Créer une classe
        </p>
        <div className="actions-row">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Nom de la classe (ex: Révisions 3e2)"
            maxLength={40}
            style={{ flex: 1 }}
          />
          <button className="link-btn" onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? "..." : "Créer"}
          </button>
        </div>

        <p className="section-label" style={{ marginTop: 20 }}>
          Mes classes
        </p>
        {classes === null ? (
          <p className="hint">Chargement...</p>
        ) : classes.length === 0 ? (
          <p className="hint">
            Pas encore de classe. Crée-en une ci-dessus, ou attends une invitation d'un ami.
          </p>
        ) : (
          <div className="card-list">
            {classes.map((c) => (
              <button
                key={c.id}
                className="topic-card"
                onClick={() => navigate(`/classes/${c.id}`)}
              >
                <div className="card-text">
                  <p className="card-name">🏫 {c.name}</p>
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
