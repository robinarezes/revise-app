import { useNavigate } from "react-router-dom";
import { Header } from "./Header";

// Shown instead of a blank screen when a bookmarked/deep-linked URL points
// to a lesson, quiz or subject that no longer exists (deleted, wrong
// account, stale "add to home screen" shortcut, etc).
export function NotFoundScreen({
  title = "Introuvable",
  message = "Ce contenu n'existe plus ou n'est plus accessible.",
}: {
  title?: string;
  message?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <Header title={title} showBack={false} />
      <div className="content-center">
        <span className="celebrate-emoji">🤔</span>
        <p className="title-md">Oups, on ne trouve pas ça</p>
        <p className="subtitle">{message}</p>
        <button className="btn btn-primary btn-block" onClick={() => navigate("/")}>
          🏠 Retour à l'accueil
        </button>
      </div>
    </div>
  );
}
