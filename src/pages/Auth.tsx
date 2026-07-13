import { useState } from "react";
import { useAuth } from "../AuthContext";
import { supabase } from "../supabaseClient";

type IdentifierType = "email" | "pseudo";

// Supabase accounts always need an email under the hood. For "pseudo"
// accounts we derive one deterministically from the chosen username, so
// login can recompute the same address without ever storing a lookup
// table or exposing real emails.
function pseudoToEmail(pseudo: string): string {
  const slug = pseudo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${slug}@pseudo.revise-app.local`;
}

export default function AuthPage() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit() {
    const trimmed = identifier.trim();
    if (!trimmed || !password) {
      setError(identifierType === "email" ? "Renseigne un email et un mot de passe." : "Renseigne un pseudo et un mot de passe.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (identifierType === "pseudo" && pseudoToEmail(trimmed) === "@pseudo.revise-app.local") {
      setError("Ce pseudo doit contenir au moins une lettre ou un chiffre.");
      return;
    }

    const resolvedEmail = identifierType === "email" ? trimmed : pseudoToEmail(trimmed);
    const pseudoForProfile = identifierType === "pseudo" ? trimmed : undefined;

    setLoading(true);
    setError(null);
    const result =
      mode === "signup"
        ? await signUp(resolvedEmail, password, pseudoForProfile)
        : await signIn(resolvedEmail, password);
    setLoading(false);
    if (result.error) {
      if (mode === "signup" && /already registered|already exists/i.test(result.error)) {
        setError(
          identifierType === "pseudo"
            ? "Ce pseudo est déjà pris. Connecte-toi plutôt, ou choisis-en un autre."
            : "Un compte existe déjà avec cet email. Connecte-toi plutôt ci-dessous."
        );
        setMode("login");
        return;
      }
      if (mode === "login" && /invalid login credentials/i.test(result.error)) {
        setError(
          identifierType === "pseudo" ? "Pseudo ou mot de passe incorrect." : "Email ou mot de passe incorrect."
        );
        return;
      }
      setError(result.error);
      return;
    }
    if (mode === "signup") {
      // "Confirm email" doit être désactivé côté Supabase pour que la
      // session soit active immédiatement après l'inscription.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (identifierType === "email") {
          setConfirmSent(true);
        } else {
          // Un compte "pseudo" n'a pas de vraie adresse à confirmer : si on
          // arrive ici, le compte est créé mais bloqué côté Supabase
          // ("Confirm email" doit être désactivé dans le dashboard).
          setError(
            "Ton compte a été créé mais ne peut pas être activé automatiquement. " +
              "Réessaie de te connecter dans quelques minutes, ou préviens-moi si ça persiste."
          );
          setMode("login");
        }
      }
    }
  }

  if (confirmSent) {
    return (
      <div className="screen">
        <div className="content-center">
          <span className="celebrate-emoji">📬</span>
          <p className="title-md">Vérifie ta boîte mail</p>
          <p className="subtitle">
            On t'a envoyé un lien de confirmation à {identifier}. Clique dessus pour activer ton
            compte, puis reviens te connecter ici.
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setConfirmSent(false);
              setMode("login");
            }}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="content-center">
        <span className="celebrate-emoji">🎓</span>
        <p className="title-lg">{mode === "signup" ? "Créer un compte" : "Se connecter"}</p>
        <p className="subtitle">
          {mode === "signup"
            ? "Ton compte sauvegarde tes leçons, ta classe et ta progression."
            : "Retrouve tes leçons et ta progression."}
        </p>

        <div className="option-pills" style={{ justifyContent: "center" }}>
          <button
            className={`option-pill ${identifierType === "email" ? "option-pill-selected" : ""}`}
            onClick={() => {
              setIdentifierType("email");
              setError(null);
            }}
          >
            ✉️ Email
          </button>
          <button
            className={`option-pill ${identifierType === "pseudo" ? "option-pill-selected" : ""}`}
            onClick={() => {
              setIdentifierType("pseudo");
              setError(null);
            }}
          >
            😀 Pseudo
          </button>
        </div>

        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={identifierType === "email" ? "Email" : "Pseudo"}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
        />

        {error ? <p className="hint" style={{ color: "var(--danger)" }}>{error}</p> : null}

        <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={loading}>
          {loading ? "..." : mode === "signup" ? "S'inscrire" : "Se connecter"}
        </button>

        <button
          className="link-btn"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError(null);
          }}
        >
          {mode === "signup" ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
        </button>
      </div>
    </div>
  );
}
