import { LANGUAGES, type Language } from "../languages";

export function LanguageSelection({
  title,
  subtitle,
  emoji,
  onChosen,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  onChosen: (language: Language) => void;
}) {
  return (
    <div className="screen">
      <div className="content-center">
        <span className="celebrate-emoji">{emoji}</span>
        <p className="title-lg">{title}</p>
        <p className="subtitle">{subtitle}</p>
        <div className="grade-grid">
          {LANGUAGES.map((lang) => (
            <button key={lang} className="grade-btn" onClick={() => onChosen(lang)}>
              {lang}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
