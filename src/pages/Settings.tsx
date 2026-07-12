import { useState } from "react";
import { useAuth } from "../AuthContext";
import { BottomNav } from "../components/BottomNav";
import { GRADES, type Grade } from "../grade";
import { LANGUAGES, type Language } from "../languages";
import { useProfile } from "../ProfileContext";

type Editing = "grade" | "lv1" | "lv2" | null;

export default function SettingsPage() {
  const { profile, updateProfile } = useProfile();
  const { signOut } = useAuth();
  const [editing, setEditing] = useState<Editing>(null);

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

        <button className="link-btn-danger" onClick={handleSignOut}>
          Se déconnecter
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
