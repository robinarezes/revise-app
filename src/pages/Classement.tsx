import { useEffect, useState } from "react";
import { BottomNav } from "../components/BottomNav";
import { getLeaderboard, type LeaderboardResponse } from "../services/leaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ClassementPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLeaderboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }, []);

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">🏆 Classement</span>
      </div>
      <div className="content">
        <p className="hint">
          Les points viennent du Quiz du jour : plus tu réponds vite et juste, plus tu en gagnes.
        </p>

        {error ? (
          <p className="hint">{error}</p>
        ) : !data ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-text">Chargement du classement...</p>
          </div>
        ) : data.ranking.length === 0 ? (
          <div className="empty-state">
            <div className="mascot">🏆</div>
            <p className="title-md">Personne n'a encore de points</p>
            <p className="hint">Fais le Quiz du jour pour apparaître en premier sur ce classement.</p>
          </div>
        ) : (
          <div className="card-list">
            {data.ranking.map((entry) => (
              <div
                key={entry.rank}
                className={`lesson-card ${entry.isMe ? "option-pill-selected" : ""}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <span className="topic-number" style={{ width: 36, height: 36, fontSize: 15 }}>
                  {MEDALS[entry.rank - 1] ?? entry.rank}
                </span>
                <div className="card-text">
                  <p className="card-name">
                    {entry.username ?? "Élève"} {entry.isMe ? "· toi" : ""}
                  </p>
                </div>
                <span className="grade-pill">⭐ {entry.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
