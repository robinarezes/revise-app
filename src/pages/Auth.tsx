import { useState } from "react";
import { useAuth } from "../AuthContext";

export default function AuthPage() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Renseigne un email et un mot de passe.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    setLoading(true);
    setError(null);
    const result =
      mode === "signup" ? await signUp(trimmedEmail, password) : await signIn(trimmedEmail, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === "signup") {
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <div className="screen">
        <div className="content-center">
          <span className="celebrate-emoji">📬</span>
          <p className="title-md">Vérifie ta boîte mail</p>
          <p className="subtitle">
            On t'a envoyé un lien de confirmation à {email}. Clique dessus pour activer ton
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

        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
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
