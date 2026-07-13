import { useLocation, useNavigate } from "react-router-dom";

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

  function isActive(path: string): boolean {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  return (
    <div className="bottom-nav">
      {TABS.map((tab) => (
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
