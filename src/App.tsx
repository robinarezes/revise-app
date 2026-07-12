import { useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { ApiKeyProvider } from "./ApiKeyContext";
import { getGrade } from "./grade";
import CapturePage from "./pages/Capture";
import ChatModePage from "./pages/ChatMode";
import ExercicePage from "./pages/ExerciceMode";
import FlashcardsPage from "./pages/FlashcardsMode";
import { GradeSelection } from "./pages/GradeSelection";
import HomePage from "./pages/Home";
import LeconPage from "./pages/Lecon";
import LeconModePage from "./pages/LeconMode";
import LeconsPage from "./pages/Lecons";
import MatierePage from "./pages/Matiere";
import ProgrammePage from "./pages/Programme";
import ProgrammeMatierePage from "./pages/ProgrammeMatiere";
import QcmPage from "./pages/QcmMode";
import RevisionPage from "./pages/Revision";
import SettingsPage from "./pages/Settings";
import StatsPage from "./pages/Stats";

export default function App() {
  const [hasGrade, setHasGrade] = useState(() => getGrade() !== null);

  if (!hasGrade) {
    return <GradeSelection onChosen={() => setHasGrade(true)} />;
  }

  return (
    <ApiKeyProvider>
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
    </ApiKeyProvider>
  );
}
