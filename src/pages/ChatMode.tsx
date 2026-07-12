import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useApiKey } from "../ApiKeyContext";
import { Header } from "../components/Header";
import { getLesson } from "../db/db";
import { askQuestion, type ChatTurn } from "../services/askQuestion";
import type { Lesson } from "../types";

export default function ChatModePage() {
  const { leconId = "" } = useParams();
  const { apiKey } = useApiKey();
  const [lesson, setLesson] = useState<Lesson | undefined>();
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getLesson(leconId).then(setLesson);
  }, [leconId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, asking]);

  async function handleSend() {
    const question = draft.trim();
    if (!question || !lesson || asking) return;
    setDraft("");
    setAsking(true);
    try {
      const result = await askQuestion({
        apiKey,
        lessonTitle: lesson.title,
        lessonText: lesson.extractedText,
        question,
        history,
      });
      setHistory((h) => [...h, { question, answer: result.answer }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      setHistory((h) => [...h, { question, answer: `⚠️ ${message}` }]);
    } finally {
      setAsking(false);
    }
  }

  if (!lesson) return <div className="screen" />;

  return (
    <div className="screen">
      <Header title={`Question · ${lesson.title}`} />
      <div className="content" style={{ flex: 1, minHeight: 0 }}>
        {history.length === 0 ? (
          <div className="chat-empty">
            <span className="mascot">💬</span>
            <p className="title-md">Pose une question sur cette leçon</p>
            <p className="hint">
              L'IA répond en se basant uniquement sur le contenu de "{lesson.title}".
            </p>
          </div>
        ) : (
          <div className="chat-scroll" ref={scrollRef}>
            {history.map((turn, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="chat-bubble chat-bubble-user">{turn.question}</div>
                <div className="chat-bubble chat-bubble-assistant">{turn.answer}</div>
              </div>
            ))}
            {asking ? (
              <div className="chat-bubble chat-bubble-assistant">
                <div className="spinner" style={{ width: 18, height: 18 }} />
              </div>
            ) : null}
          </div>
        )}

        <div className="chat-input-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Écris ta question..."
            disabled={asking}
          />
          <button
            className="btn btn-primary"
            style={{ padding: "12px 20px" }}
            onClick={handleSend}
            disabled={asking || !draft.trim()}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
