import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { BottomNav } from "../components/BottomNav";
import { ToggleSwitch } from "../components/ToggleSwitch";
import { GRADES, type Grade } from "../grade";
import { LANGUAGES, type Language } from "../languages";
import type { DyslexiaFont, DyslexiaSize, DyslexiaTint } from "../ProfileContext";
import { useProfile } from "../ProfileContext";
import { openBillingPortal, redeemPremiumCode } from "../services/subscription";
import { TTS_VOICES } from "../services/tts";

type Editing = "grade" | "lv1" | "lv2" | null;

const FONT_OPTIONS: { value: DyslexiaFont; label: string }[] = [
  { value: "system", label: "Standard" },
  { value: "opendyslexic", label: "OpenDyslexic" },
  { value: "lexend", label: "Lexend" },
];

const TINT_OPTIONS: { value: DyslexiaTint; label: string; swatch: string }[] = [
  { value: "cream", label: "Crème", swatch: "#fbf3e3" },
  { value: "blue", label: "Bleu", swatch: "#e8f0fe" },
  { value: "green", label: "Vert", swatch: "#e9f7ea" },
  { value: "pink", label: "Rose", swatch: "#fdebf1" },
  { value: "none", label: "Aucune", swatch: "#ffffff" },
];

const SIZE_OPTIONS: { value: DyslexiaSize; label: string }[] = [
  { value: "small", label: "Petit" },
  { value: "medium", label: "Moyen" },
  { value: "large", label: "Grand" },
];

function OptionPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; swatch?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="option-pills">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`option-pill ${opt.value === value ? "option-pill-selected" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.swatch ? (
            <span className="option-pill-swatch" style={{ background: opt.swatch }} />
          ) : null}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
  const [premiumCode, setPremiumCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? "");
  }, [profile?.username]);

  async function handleSaveUsername() {
    const trimmed = username.trim();
    setUsernameError(null);
    try {
      await updateProfile({ username: trimmed || null });
      setUsernameSaved(true);
      setTimeout(() => setUsernameSaved(false), 2000);
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    }
  }

  async function handlePrefChange(patch: Parameters<typeof updateProfile>[0]) {
    setPrefsError(null);
    try {
      await updateProfile(patch);
    } catch (e) {
      setPrefsError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    }
  }

  useEffect(() => {
    if (searchParams.get("upgraded") !== "1" || isPremium) return;
    // Le webhook Stripe met à jour l'abonnement en général en quelques
    // secondes : on revérifie une fois après un court délai.
    const timer = setTimeout(() => refetchProfile(), 2500);
    return () => clearTimeout(timer);
  }, [searchParams, isPremium, refetchProfile]);

  async function handleRedeemCode() {
    if (!premiumCode.trim()) return;
    setCodeLoading(true);
    setCodeError(null);
    try {
      await redeemPremiumCode(premiumCode);
      setPremiumCode("");
      await refetchProfile();
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setCodeLoading(false);
    }
  }

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
        {usernameError ? (
          <p className="hint" style={{ color: "var(--danger)" }}>
            {usernameError}
          </p>
        ) : null}

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
              Passe en illimité : plus de limite quotidienne sur l'IA, dès 3,99 €/mois (ou
              29,99 €/an, soit 2,50 €/mois).
            </p>
            <button className="btn btn-primary btn-block" onClick={() => navigate("/premium")}>
              ⭐ Passer à Premium
            </button>

            <label className="field-label" style={{ marginTop: 12 }}>
              Un code premium ?
            </label>
            {codeError ? (
              <p className="hint" style={{ color: "var(--danger)" }}>
                {codeError}
              </p>
            ) : null}
            <div className="actions-row">
              <input
                type="text"
                value={premiumCode}
                onChange={(e) => setPremiumCode(e.target.value)}
                placeholder="Ton code"
                style={{ flex: 1 }}
              />
              <button className="link-btn" onClick={handleRedeemCode} disabled={codeLoading}>
                {codeLoading ? "..." : "Valider"}
              </button>
            </div>
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

        {profile?.dyslexia_mode ? (
          <>
            <label className="field-label" style={{ marginTop: 12 }}>
              Police d'écriture
            </label>
            <OptionPills
              options={FONT_OPTIONS}
              value={profile.dyslexia_font}
              onChange={(v) => handlePrefChange({ dyslexia_font: v })}
            />

            <label className="field-label" style={{ marginTop: 12 }}>
              Teinte du fond
            </label>
            <OptionPills
              options={TINT_OPTIONS}
              value={profile.dyslexia_tint}
              onChange={(v) => handlePrefChange({ dyslexia_tint: v })}
            />

            <label className="field-label" style={{ marginTop: 12 }}>
              Taille du texte
            </label>
            <OptionPills
              options={SIZE_OPTIONS}
              value={profile.dyslexia_size}
              onChange={(v) => handlePrefChange({ dyslexia_size: v })}
            />

            <label className="field-label" style={{ marginTop: 12 }}>
              Voix de lecture
            </label>
            <select
              value={profile.tts_voice}
              onChange={(e) => handlePrefChange({ tts_voice: e.target.value })}
              style={{ width: "100%" }}
            >
              {TTS_VOICES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            {prefsError ? (
              <p className="hint" style={{ color: "var(--danger)" }}>
                {prefsError}
              </p>
            ) : null}
          </>
        ) : null}

        <button className="link-btn-danger" onClick={handleSignOut}>
          Se déconnecter
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
