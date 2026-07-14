import type { ReactElement } from "react";

// Rendu simple d'un texte généré par l'IA : titres "#"/"##"/"###", puces
// "- ", et mots-clés **en gras** surlignés. Pas un vrai moteur Markdown,
// juste ce que nos prompts utilisent.
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\*\*([^*]+)\*\*$/);
        if (match) {
          return (
            <mark key={i} className="keyword">
              {match[1]}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function HighlightedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: ReactElement[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul className="lesson-bullets" key={`ul-${elements.length}`}>
        {bulletBuffer.map((item, i) => (
          <li key={i}>
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushBullets();
      const level = heading[1].length;
      const content = heading[2];
      const className = level === 1 ? "lesson-h1" : level === 2 ? "lesson-h2" : "lesson-h3";
      elements.push(
        <p className={className} key={i}>
          <InlineText text={content} />
        </p>
      );
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      bulletBuffer.push(bullet[1]);
      return;
    }

    flushBullets();
    elements.push(
      <p className="extracted-text" key={i}>
        <InlineText text={trimmed} />
      </p>
    );
  });
  flushBullets();

  return <div className="lesson-text">{elements}</div>;
}
