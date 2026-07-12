import { useState } from "react";
import { BottomNav } from "../components/BottomNav";
import { useApiKey } from "../ApiKeyContext";
import { GRADES, getGrade, setGrade, type Grade } from "../grade";

export default function SettingsPage() {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [draft, setDraft] = useState(apiKey ?? "");
  const [grade, setGradeState] = useState(getGrade());
  const [editingGrade, setEditingGrade] = useState(false);

  function handleSave() {
    if (!draft.trim()) {
      alert("Colle ta clé API Claude avant d'enregistrer.");
      return;
    }
    setApiKey(draft);
    alert("Clé API enregistrée sur cet appareil. Tu as maintenant un usage illimité.");
  }

  function handleClear() {
    if (!confirm("Supprimer ta clé API ? Tu repasseras sur l'usage gratuit avec quota quotidien.")) return;
    clearApiKey();
    setDraft("");
  }

  function handlePickGrade(g: Grade) {
    setGrade(g);
    setGradeState(g);
    setEditingGrade(false);
  }

  return (
    <div className="screen">
      <div className="tab-header">
        <span className="tab-header-title">Réglages</span>
      </div>
      <div className="content">
        <label className="field-label">Ma classe</label>
        {editingGrade ? (
          <div className="grade-grid">
            {GRADES.map((g) => (
              <button key={g} className="grade-btn" onClick={() => handlePickGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        ) : (
          <div className="actions-row">
            <span className="grade-pill">🎓 {grade}</span>
            <button className="link-btn" onClick={() => setEditingGrade(true)}>
              Changer
            </button>
          </div>
        )}

        <p className="hint">
          L'app est utilisable gratuitement, sans rien configurer : tu as droit à quelques
          leçons par jour. Pour un usage illimité, tu peux ajouter ta propre clé API Claude
          (optionnel).
        </p>

        <label className="field-label">Clé API Claude (optionnel)</label>
        <p className="hint">
          Disponible sur console.anthropic.com. Reste stockée uniquement dans ce navigateur,
          sur cet appareil.
        </p>
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-..."
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button className="btn btn-primary btn-block" onClick={handleSave}>
          Enregistrer
        </button>
        {apiKey ? (
          <button className="link-btn-danger" onClick={handleClear}>
            Supprimer la clé (revenir à l'usage gratuit)
          </button>
        ) : (
          <p className="hint">Usage gratuit actif — aucune clé enregistrée.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
