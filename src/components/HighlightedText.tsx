// Renders text where **word** segments (Markdown-style bold from the AI's
// lesson summary) are shown as highlighted keywords.
export function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <p className="extracted-text">
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
    </p>
  );
}
