import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "../components/BottomNav";
import { getLeaderboard, type LeaderboardEntry, type LeaderboardResponse } from "../services/leaderboard";

const PODIUM_ORDER = [2, 1, 3];
const PODIUM_HEIGHT: Record<number, number> = { 1: 108, 2: 84, 3: 64 };
const PODIUM_COLOR: Record<number, string> = { 1: "#FFC800", 2: "#C7CCD4", 3: "#E0A45C" };
const PODIUM_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function league(rank: number): { name: string; icon: string; color: string } {
  if (rank === 1) return { name: "Diamant", icon: "💎", color: "#7DD3FC" };
  if (rank <= 5) return { name: "Or", icon: "🥇", color: "#FFC800" };
  if (rank <= 15) return { name: "Argent", icon: "🥈", color: "#C7CCD4" };
  return { name: "Bronze", icon: "🥉", color: "#E0A45C" };
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatWeekEnd(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export default function ClassementPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLeaderboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue."));
  }, []);

  const podium = data?.ranking.filter((e) => e.rank <= 3) ?? [];
  const rest = data?.ranking.filter((e) => e.rank > 3) ?? [];
  const myLeague = data?.me.rank ? league(data.me.rank) : null;

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">🏆 Classement</span>
      </div>
      <div className="content">
        <p className="hint">
          Classement de la semaine : les points du Quiz du jour repartent à zéro chaque lundi.
          {data?.weekStart ? ` Fin de la semaine : ${formatWeekEnd(data.weekStart)}.` : ""}
        </p>

        {myLeague ? (
          <div className="league-banner" style={{ borderColor: myLeague.color }}>
            <span className="league-banner-icon">{myLeague.icon}</span>
            <div className="card-text">
              <p className="card-name">Ligue {myLeague.name}</p>
              <p className="card-meta">
                {data?.me.rank ? `${data.me.rank}ᵉ place` : ""} · {data?.me.points ?? 0} points cette semaine
              </p>
            </div>
          </div>
        ) : null}

        {data?.me.needsUsername ? (
          <div className="verdict-box verdict-partiel">
            <p className="verdict-label">Tu as {data.me.points} points, mais pas de pseudo</p>
            <p className="verdict-feedback">
              Choisis un pseudo dans Réglages pour apparaître dans le classement.
            </p>
            <button className="link-btn" onClick={() => navigate("/settings")} style={{ padding: 0 }}>
              Aller dans Réglages
            </button>
          </div>
        ) : null}

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
            <p className="title-md">Personne n'a encore de points cette semaine</p>
            <p className="hint">Fais le Quiz du jour pour être le premier de la nouvelle semaine.</p>
          </div>
        ) : (
          <>
            {podium.length > 0 ? (
              <div className="podium-row">
                {PODIUM_ORDER.map((rank) => {
                  const entry = podium.find((e) => e.rank === rank);
                  if (!entry) return <div key={rank} className="podium-slot" />;
                  return <PodiumSlot key={rank} entry={entry} />;
                })}
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div className="card-list" style={{ marginTop: 8 }}>
                {rest.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`rank-row ${entry.isMe ? "rank-row-me" : ""}`}
                  >
                    <span className="rank-row-number">{entry.rank}</span>
                    <div
                      className="rank-row-avatar"
                      style={{ background: league(entry.rank).color }}
                    >
                      {initial(entry.username)}
                    </div>
                    <div className="card-text">
                      <p className="card-name">
                        {entry.username} {entry.isMe ? "· toi" : ""}
                      </p>
                    </div>
                    <span className="grade-pill">⭐ {entry.points}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function PodiumSlot({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="podium-slot">
      <span className="podium-medal">{PODIUM_MEDAL[entry.rank]}</span>
      <div className="podium-avatar" style={{ background: PODIUM_COLOR[entry.rank] }}>
        {initial(entry.username)}
      </div>
      <p className="podium-name">
        {entry.username}
        {entry.isMe ? " (toi)" : ""}
      </p>
      <p className="podium-points">{entry.points} pts</p>
      <div
        className="podium-bar"
        style={{ height: PODIUM_HEIGHT[entry.rank], background: PODIUM_COLOR[entry.rank] }}
      />
    </div>
  );
}
