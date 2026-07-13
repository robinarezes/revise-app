import { useEffect, useRef, useState } from "react";
import { useProfile } from "../ProfileContext";
import { synthesizeSpeech } from "../services/tts";

// Strips the **keyword** markdown-style markup used to highlight key terms,
// so it isn't read aloud as "étoile étoile".
function cleanForSpeech(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function SpeakButton({ text }: { text: string }) {
  const { profile } = useProfile();
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const webSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  function stopAll() {
    audioRef.current?.pause();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (webSpeechSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  useEffect(() => stopAll, []);

  function speakWithBrowserVoice() {
    if (!webSpeechSupported) {
      setError("Lecture à voix haute indisponible pour le moment.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(cleanForSpeech(text));
    utterance.lang = "fr-FR";
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  async function handleClick() {
    if (speaking) {
      stopAll();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const blob = await synthesizeSpeech(text, profile?.tts_voice || "alloy");
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stopAll;
      audio.onerror = stopAll;
      await audio.play();
      setSpeaking(true);
    } catch {
      // Real voice unavailable (pas encore configurée, quota atteint, etc.) :
      // on retombe sur la voix du navigateur plutôt que de bloquer la lecture.
      speakWithBrowserVoice();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="speak-btn" onClick={handleClick} disabled={loading}>
        {loading ? "⏳ Préparation..." : speaking ? "⏹️ Arrêter la lecture" : "🔊 Lire à voix haute"}
      </button>
      {error ? (
        <p className="hint" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
