import { HashRouter, Route, Routes } from "react-router-dom";
import { ApiKeyProvider } from "./ApiKeyContext";
import CapturePage from "./pages/Capture";
import ExercicePage from "./pages/ExerciceMode";
import FlashcardsPage from "./pages/FlashcardsMode";
import HomePage from "./pages/Home";
import LeconPage from "./pages/Lecon";
import LeconModePage from "./pages/LeconMode";
import MatierePage from "./pages/Matiere";
import QcmPage from "./pages/QcmMode";
import RevisionPage from "./pages/Revision";
import SettingsPage from "./pages/Settings";
import StatsPage from "./pages/Stats";

export default function App() {
  return (
    <ApiKeyProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
        </Routes>
      </HashRouter>
    </ApiKeyProvider>
  );
}
