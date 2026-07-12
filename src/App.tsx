import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthPage from "./pages/Auth";
import CapturePage from "./pages/Capture";
import ChatModePage from "./pages/ChatMode";
import ExercicePage from "./pages/ExerciceMode";
import FlashcardsPage from "./pages/FlashcardsMode";
import HomePage from "./pages/Home";
import LeconPage from "./pages/Lecon";
import LeconModePage from "./pages/LeconMode";
import LeconsPage from "./pages/Lecons";
import MatierePage from "./pages/Matiere";
import { Onboarding } from "./pages/Onboarding";
import ProgrammePage from "./pages/Programme";
import ProgrammeMatierePage from "./pages/ProgrammeMatiere";
import QcmPage from "./pages/QcmMode";
import RevisionPage from "./pages/Revision";
import SettingsPage from "./pages/Settings";
import StatsPage from "./pages/Stats";
import { ProfileProvider, useProfile } from "./ProfileContext";

function AppGate() {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  if (authLoading) return <div className="screen" />;
  if (!session) return <AuthPage />;
  if (profileLoading || !profile) return <div className="screen" />;
  if (!profile.grade || !profile.lv1 || !profile.lv2) return <Onboarding />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lecons" element={<LeconsPage />} />
        <Route path="/programme" element={<ProgrammePage />} />
        <Route path="/programme/:matiere" element={<ProgrammeMatierePage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/matiere/:id" element={<MatierePage />} />
        <Route path="/lecon/:id" element={<LeconPage />} />
        <Route path="/revision/:leconId" element={<RevisionPage />} />
        <Route path="/revision/:leconId/apprendre" element={<LeconModePage />} />
        <Route path="/revision/:leconId/qcm" element={<QcmPage />} />
        <Route path="/revision/:leconId/flashcards" element={<FlashcardsPage />} />
        <Route path="/revision/:leconId/exercice" element={<ExercicePage />} />
        <Route path="/revision/:leconId/demander" element={<ChatModePage />} />
      </Routes>
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
