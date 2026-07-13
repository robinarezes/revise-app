import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { BottomNav } from "../components/BottomNav";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { GRADES, type Grade } from "../grade";
import { LANGUAGES, type Language } from "../languages";
import { useProfile } from "../ProfileContext";
import { openBillingPortal } from "../services/subscription";

type Editing = "grade" | "lv1" | "lv2" | null;

export default function SettingsPage() {
  const { profile, isPremium, updateProfile, refetchProfile } = useProfile();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState<Editing>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [username, setUsername] = useState(profile?.username ?? "");
  const [usernameSaved, setUsernameSaved] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);

  async function handleSaveUsername() {
    const trimmed = username.trim();
    await updateProfile({ username: trimmed || null });
    setUsernameSaved(true);
    setTimeout(() => setUsernameSaved(false), 2000);
  }

  useEffect(() => {
    if (searchParams.get("upgraded") !== "1" || isPremium) return;
    // Le webhook Stripe met à jour l'abonnement en général en quelques
    // secondes : on revérifie une fois après un court délai.
    const timer = setTimeout(() => refetchProfile(), 2500);
    return () => clearTimeout(timer);
  }, [searchParams, isPremium, refetchProfile]);

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await openBillingPortal();
      window.location.href = url;
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : "Erreur inconnue.");
      setPortalLoading(false);
    }
  }

  function handlePickGrade(g: Grade) {
    updateProfile({ grade: g });
    setEditing(null);
  }

  function handlePickLv1(l: Language) {
    updateProfile({ lv1: l });
    setEditing(null);
  }

  function handlePickLv2(l: Language) {
    updateProfile({ lv2: l });
    setEditing(null);
  }

  async function handleSignOut() {
    if (!confirm("Te déconnecter ?")) return;
    await signOut();
  }

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Réglages</span>
      </div>
      <div className="content">
        <label className="field-label">Compte</label>
        <div className="actions-row">
          <span className="grade-pill">✉️ {session?.user.email}</span>
        </div>

        <label className="field-label" style={{ marginTop: 12 }}>
          Nom d'utilisateur
        </label>
        <div className="actions-row">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ton pseudo"
            maxLength={30}
            style={{ flex: 1 }}
          />
          <button className="link-btn" onClick={handleSaveUsername}>
            {usernameSaved ? "✅" : "Enregistrer"}
          </button>
        </div>

        <label className="field-label">Ma classe</label>
        {editing === "grade" ? (
          <div className="grade-grid">
            {GRADES.map((g) => (
              <button key={g} className="grade-btn" onClick={() => handlePickGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        ) : (
          <div className="actions-row">
            <span className="grade-pill">🎓 {profile?.grade}</span>
            <button className="link-btn" onClick={() => setEditing("grade")}>
              Changer
            </button>
          </div>
        )}

        <label className="field-label">Ma LV1</label>
        {editing === "lv1" ? (
          <div className="grade-grid">
            {LANGUAGES.map((l) => (
              <button key={l} className="grade-btn" onClick={() => handlePickLv1(l)}>
                {l}
              </button>
            ))}
          </div>
        ) : (
          <div className="actions-row">
            <span className="grade-pill">🇬🇧 {profile?.lv1}</span>
            <button className="link-btn" onClick={() => setEditing("lv1")}>
              Changer
            </button>
          </div>
        )}

        <label className="field-label">Ma LV2</label>
        {editing === "lv2" ? (
          <div className="grade-grid">
            {LANGUAGES.map((l) => (
              <button key={l} className="grade-btn" onClick={() => handlePickLv2(l)}>
                {l}
              </button>
            ))}
          </div>
        ) : (
          <div className="actions-row">
            <span className="grade-pill">🌍 {profile?.lv2}</span>
            <button className="link-btn" onClick={() => setEditing("lv2")}>
              Changer
            </button>
          </div>
        )}

        <label className="field-label">Abonnement</label>
        {isPremium ? (
          <>
            <div className="actions-row">
              <span className="grade-pill">⭐ Premium actif</span>
            </div>
            {portalError ? (
              <p className="hint" style={{ color: "var(--danger)" }}>
                {portalError}
              </p>
            ) : null}
            <button
              className="btn btn-secondary btn-block"
              onClick={handleManageSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? "..." : "Gérer mon abonnement"}
            </button>
          </>
        ) : (
          <>
            <p className="hint">
              Passe en illimité : plus de limite quotidienne sur l'IA, à partir de 2,50 €/mois.
            </p>
            <button className="btn btn-primary btn-block" onClick={() => navigate("/premium")}>
              ⭐ Passer à Premium
            </button>
          </>
        )}

        <label className="field-label">Mode dyslexique</label>
        <p className="hint">
          Texte plus grand et plus espacé, fond teinté, leçons réécrites en version simplifiée
          par l'IA, et lecture à voix haute.
        </p>
        <div className="toggle-row">
          <span className="card-name">Activer</span>
          <ToggleSwitch
            checked={profile?.dyslexia_mode ?? false}
            onChange={(value) => updateProfile({ dyslexia_mode: value })}
          />
        </div>

        <button className="link-btn-danger" onClick={handleSignOut}>
          Se déconnecter
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
