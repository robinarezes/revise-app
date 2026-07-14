import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import {
  getFriendData,
  removeFriendRequest,
  respondFriendRequest,
  searchUsersByUsername,
  sendFriendRequest,
} from "../db/db";
import type { FriendEntry } from "../types";

export default function FriendsPage() {
  const [entries, setEntries] = useState<FriendEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  function reload() {
    getFriendData()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }

  useEffect(reload, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchUsersByUsername(trimmed)
        .then((r) => {
          if (!cancelled) setResults(r);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleSendRequest(userId: string) {
    setError(null);
    try {
      await sendFriendRequest(userId);
      setSentTo((s) => new Set(s).add(userId));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setError(null);
    try {
      await respondFriendRequest(requestId, accept);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  async function handleRemove(requestId: string) {
    setError(null);
    try {
      await removeFriendRequest(requestId);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    }
  }

  const friends = entries?.filter((e) => e.relation === "friend") ?? [];
  const incoming = entries?.filter((e) => e.relation === "incoming") ?? [];
  const outgoing = entries?.filter((e) => e.relation === "outgoing") ?? [];
  const knownUserIds = new Set(entries?.map((e) => e.userId) ?? []);

  return (
    <div className="screen">
      <Header title="Amis" />
      <div className="content">
        {error ? (
          <p className="hint" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        <label className="field-label">Ajouter un ami</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cherche un pseudo..."
          autoCapitalize="off"
          autoCorrect="off"
          style={{ width: "100%" }}
        />
        {searching ? <p className="hint">Recherche...</p> : null}
        {results.length > 0 ? (
          <div className="card-list" style={{ marginTop: 8 }}>
            {results.map((r) => {
              const already = knownUserIds.has(r.id) || sentTo.has(r.id);
              return (
                <div key={r.id} className="topic-card">
                  <div className="card-text">
                    <p className="card-name">{r.username}</p>
                  </div>
                  <button
                    className="link-btn"
                    disabled={already}
                    onClick={() => handleSendRequest(r.id)}
                  >
                    {already ? "Envoyée ✓" : "Ajouter"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        {incoming.length > 0 ? (
          <>
            <p className="section-label" style={{ marginTop: 20 }}>
              Demandes reçues
            </p>
            <div className="card-list">
              {incoming.map((e) => (
                <div key={e.requestId} className="topic-card">
                  <div className="card-text">
                    <p className="card-name">{e.username}</p>
                  </div>
                  <div className="actions-row" style={{ margin: 0 }}>
                    <button className="link-btn" onClick={() => handleRespond(e.requestId, true)}>
                      ✅
                    </button>
                    <button className="link-btn" onClick={() => handleRespond(e.requestId, false)}>
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {outgoing.length > 0 ? (
          <>
            <p className="section-label" style={{ marginTop: 20 }}>
              Demandes envoyées
            </p>
            <div className="card-list">
              {outgoing.map((e) => (
                <div key={e.requestId} className="topic-card">
                  <div className="card-text">
                    <p className="card-name">{e.username}</p>
                  </div>
                  <button className="link-btn" onClick={() => handleRemove(e.requestId)}>
                    Annuler
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <p className="section-label" style={{ marginTop: 20 }}>
          Mes amis {friends.length > 0 ? `(${friends.length})` : ""}
        </p>
        {entries === null ? (
          <p className="hint">Chargement...</p>
        ) : friends.length === 0 ? (
          <p className="hint">Pas encore d'ami. Cherche un pseudo ci-dessus pour en ajouter.</p>
        ) : (
          <div className="card-list">
            {friends.map((e) => (
              <div key={e.requestId} className="topic-card">
                <div className="card-text">
                  <p className="card-name">{e.username}</p>
                </div>
                <button className="link-btn" onClick={() => handleRemove(e.requestId)}>
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
