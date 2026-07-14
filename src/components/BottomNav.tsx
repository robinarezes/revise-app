import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "../ProfileContext";

const TABS = [
  { path: "/", icon: "🏠", label: "Accueil" },
  { path: "/programme", icon: "📘", label: "Programme" },
  { path: "/lecons", icon: "📑", label: "Leçons" },
  { path: "/stats", icon: "📊", label: "Stats" },
  { path: "/classement", icon: "🏆", label: "Rang" },
  { path: "/settings", icon: "⚙️", label: "Réglages" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdultMode } = useProfile();

  function isActive(path: string): boolean {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  // Le Programme suit le programme scolaire français par classe : sans
  // objet en mode Adulte, qui tourne autour de la culture générale.
  const tabs = isAdultMode ? TABS.filter((t) => t.path !== "/programme") : TABS;

  return (
    <div className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={`bottom-nav-item ${isActive(tab.path) ? "active" : ""}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
