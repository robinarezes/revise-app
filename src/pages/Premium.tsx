import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "../components/Header";
import { useProfile } from "../ProfileContext";
import { startCheckout } from "../services/subscription";

const PERKS = [
  "Utilisation illimitée de l'IA, sans limite quotidienne",
  "Génération de leçons, QCM, flashcards et exercices en illimité",
  "Quiz général rejouable à volonté pour gagner des points",
  "Simplification des leçons et lecture à voix haute incluses",
  "Le programme scolaire complet, toutes matières",
];

type Plan = "monthly" | "yearly";

export default function PremiumPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isPremium } = useProfile();
  const [plan, setPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = searchParams.get("raison");

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const { url } = await startCheckout(plan);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
      setLoading(false);
    }
  }

  if (isPremium) {
    return (
      <div className="screen">
        <Header title="Révise Premium" />
        <div className="content-center">
          <span className="celebrate-emoji">⭐</span>
          <p className="title-md">Tu es déjà abonné !</p>
          <p className="subtitle">Profite de l'IA en illimité, tous les jours.</p>
          <button className="btn btn-secondary btn-block" onClick={() => navigate("/")}>
            🏠 Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title="Révise Premium" />
      <div className="content-center">
        <span className="celebrate-emoji">⭐</span>
        <p className="title-md">Passe à Révise Premium</p>
        <p className="subtitle">
          {reason === "quota"
            ? "Tu as atteint la limite gratuite du jour. Passe en illimité pour continuer sans attendre."
            : "Débloque l'IA en illimité pour réviser sans jamais être bloqué par la limite quotidienne."}
        </p>

        <div className="card-list" style={{ width: "100%", textAlign: "left" }}>
          {PERKS.map((perk) => (
            <div key={perk} className="premium-perk">
              ✅ {perk}
            </div>
          ))}
        </div>

        <div className="plan-picker">
          <button
            className={`plan-option ${plan === "yearly" ? "plan-option-selected" : ""}`}
            onClick={() => setPlan("yearly")}
          >
            <span className="plan-badge">MEILLEURE OFFRE · -37%</span>
            <span className="plan-option-row">
              <span className="plan-name">Annuel</span>
              <span className="plan-amount">29,99 € / an</span>
            </span>
            <span className="plan-sub">soit 2,50 €/mois</span>
          </button>
          <button
            className={`plan-option ${plan === "monthly" ? "plan-option-selected" : ""}`}
            onClick={() => setPlan("monthly")}
          >
            <span className="plan-option-row">
              <span className="plan-name">Mensuel</span>
              <span className="plan-amount">3,99 € / mois</span>
            </span>
            <span className="plan-sub">sans engagement</span>
          </button>
        </div>
        <p className="hint">Résiliable à tout moment, en un clic.</p>

        {error ? <p className="hint" style={{ color: "var(--danger)" }}>{error}</p> : null}

        <button
          className="btn btn-primary btn-block"
          onClick={handleSubscribe}
          disabled={loading}
        >
          {loading ? "..." : "S'abonner"}
        </button>
        <button className="link-btn" onClick={() => navigate("/")}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
