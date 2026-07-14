import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { ADULT_GRADE } from "./grade";
import AuthPage from "./pages/Auth";
import { Onboarding } from "./pages/Onboarding";
import { ProfileProvider, useProfile } from "./ProfileContext";

// Chaque page est chargée à la demande (au lieu d'un seul gros bundle
// initial) : le premier chargement du site ne télécharge que ce dont
// l'écran affiché a besoin, les autres pages arrivent en arrière-plan
// dès qu'on y navigue.
const HomePage = lazy(() => import("./pages/Home"));
const DailyQuizPage = lazy(() => import("./pages/DailyQuiz"));
const GeneralQuizSubjectsPage = lazy(() => import("./pages/GeneralQuizSubjects"));
const GeneralQuizPage = lazy(() => import("./pages/GeneralQuiz"));
const PremiumPage = lazy(() => import("./pages/Premium"));
const LeconsPage = lazy(() => import("./pages/Lecons"));
const FriendsPage = lazy(() => import("./pages/Friends"));
const ClassesPage = lazy(() => import("./pages/Classes"));
const ClassDetailPage = lazy(() => import("./pages/ClassDetail"));
const ProgrammePage = lazy(() => import("./pages/Programme"));
const ProgrammeMatierePage = lazy(() => import("./pages/ProgrammeMatiere"));
const StatsPage = lazy(() => import("./pages/Stats"));
const ClassementPage = lazy(() => import("./pages/Classement"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const CapturePage = lazy(() => import("./pages/Capture"));
const MatierePage = lazy(() => import("./pages/Matiere"));
const LeconPage = lazy(() => import("./pages/Lecon"));
const RevisionPage = lazy(() => import("./pages/Revision"));
const LeconModePage = lazy(() => import("./pages/LeconMode"));
const QcmPage = lazy(() => import("./pages/QcmMode"));
const FlashcardsPage = lazy(() => import("./pages/FlashcardsMode"));
const ExercicePage = lazy(() => import("./pages/ExerciceMode"));
const ChatModePage = lazy(() => import("./pages/ChatMode"));
const DiagramModePage = lazy(() => import("./pages/DiagramMode"));

function ProfileErrorScreen() {
  const { signOut } = useAuth();
  return (
    <div className="screen">
      <div className="content-center">
        <span className="celebrate-emoji">😕</span>
        <p className="title-md">Impossible de charger ton profil</p>
        <p className="subtitle">
          Vérifie ta connexion internet et réessaie. Si le problème persiste, déconnecte-toi puis
          reconnecte-toi.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
          Réessayer
        </button>
        <button className="link-btn" onClick={() => signOut()}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

function AppGate() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, isAdultMode } = useProfile();

  if (authLoading) return <div className="screen" />;
  if (!session) return <AuthPage />;
  if (profileLoading) return <div className="screen" />;
  if (!profile) return <ProfileErrorScreen />;
  // Le mode Adulte n'a pas de programme scolaire : LV1/LV2 ne lui servent à
  // rien, l'onboarding s'arrête donc dès la classe choisie.
  const needsLanguages = profile.grade !== ADULT_GRADE;
  if (!profile.grade || (needsLanguages && (!profile.lv1 || !profile.lv2))) return <Onboarding />;

  // Le Programme suit le programme scolaire français par classe : sans objet
  // en mode Adulte (accès direct par URL redirigé, en plus d'être caché du
  // menu).
  const redirectHome = <Navigate to="/" replace />;

  return (
    <HashRouter>
      <Suspense fallback={<div className="screen" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz-du-jour/:subject" element={<DailyQuizPage />} />
          <Route
            path="/quiz-general"
            element={
              isAdultMode ? (
                <Navigate to={`/quiz-general/${encodeURIComponent("Culture générale")}`} replace />
              ) : (
                <GeneralQuizSubjectsPage />
              )
            }
          />
          <Route path="/quiz-general/:subject" element={<GeneralQuizPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/lecons" element={isAdultMode ? redirectHome : <LeconsPage />} />
          <Route path="/amis" element={isAdultMode ? redirectHome : <FriendsPage />} />
          <Route path="/classes" element={isAdultMode ? redirectHome : <ClassesPage />} />
          <Route path="/classes/:id" element={isAdultMode ? redirectHome : <ClassDetailPage />} />
          <Route path="/programme" element={isAdultMode ? redirectHome : <ProgrammePage />} />
          <Route
            path="/programme/:matiere"
            element={isAdultMode ? redirectHome : <ProgrammeMatierePage />}
          />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/classement" element={<ClassementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/capture" element={isAdultMode ? redirectHome : <CapturePage />} />
          <Route path="/matiere/:id" element={<MatierePage />} />
          <Route path="/lecon/:id" element={<LeconPage />} />
          <Route path="/revision/:leconId" element={<RevisionPage />} />
          <Route path="/revision/:leconId/apprendre" element={<LeconModePage />} />
          <Route path="/revision/:leconId/qcm" element={<QcmPage />} />
          <Route path="/revision/:leconId/flashcards" element={<FlashcardsPage />} />
          <Route path="/revision/:leconId/exercice" element={<ExercicePage />} />
          <Route path="/revision/:leconId/demander" element={<ChatModePage />} />
          <Route path="/revision/:leconId/schema" element={<DiagramModePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <AppGate />
      </ProfileProvider>
    </AuthProvider>
  );
}
