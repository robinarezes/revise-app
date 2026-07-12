import { useEffect, useState } from "react";

// Strips the **keyword** markdown-style markup used to highlight key terms,
// so it isn't read aloud as "étoile étoile".
function cleanForSpeech(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

export function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  if (!supported) return null;

  function handleClick() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
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

  return (
    <button className="speak-btn" onClick={handleClick}>
      {speaking ? "⏹️ Arrêter la lecture" : "🔊 Lire à voix haute"}
    </button>
  );
}
