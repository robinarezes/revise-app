import { useNavigate } from "react-router-dom";

export function Header({ title, showBack = true }: { title: string; showBack?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="header">
      {showBack ? (
        <button className="header-back" onClick={() => navigate(-1)}>
          ‹ Retour
        </button>
      ) : (
        <div className="header-spacer" />
      )}
      <div className="header-title">{title}</div>
      <div className="header-spacer" />
    </div>
  );
}
