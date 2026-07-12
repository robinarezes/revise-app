import { useLocation, useNavigate } from "react-router-dom";

const TABS = [
  { path: "/", icon: "🏠", label: "Accueil" },
  { path: "/stats", icon: "📊", label: "Stats" },
  { path: "/settings", icon: "⚙️", label: "Réglages" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab.path}
          className={`bottom-nav-item ${location.pathname === tab.path ? "active" : ""}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
