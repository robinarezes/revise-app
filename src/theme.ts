const subjectPalette = [
  "#1CB0F6",
  "#FF4B4B",
  "#58CC02",
  "#FFC800",
  "#CE82FF",
  "#FF9600",
  "#FF86D0",
  "#2B70C9",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function colorForSubject(subjectId: string): string {
  return subjectPalette[hashString(subjectId) % subjectPalette.length];
}

const SUBJECT_EMOJI_MAP: Record<string, string> = {
  maths: "🧮",
  mathematiques: "🧮",
  "mathématiques": "🧮",
  histoire: "🏛️",
  "géographie": "🌍",
  geographie: "🌍",
  "histoire-géographie": "🏛️",
  francais: "📖",
  "français": "📖",
  anglais: "🇬🇧",
  espagnol: "🇪🇸",
  allemand: "🇩🇪",
  italien: "🇮🇹",
  svt: "🌱",
  biologie: "🌱",
  physique: "⚛️",
  chimie: "🧪",
  "physique-chimie": "⚛️",
  philosophie: "🦉",
  sport: "⚽",
  eps: "⚽",
  musique: "🎵",
  arts: "🎨",
  "arts plastiques": "🎨",
  technologie: "⚙️",
  "économie": "📈",
  economie: "📈",
  ses: "📈",
  informatique: "💻",
  droit: "⚖️",
  medecine: "🩺",
  "médecine": "🩺",
};

const FALLBACK_EMOJIS = ["📘", "📗", "📙", "📕", "📓", "📔", "📒"];

export function emojiForSubject(name: string, subjectId: string): string {
  const key = name.trim().toLowerCase();
  if (SUBJECT_EMOJI_MAP[key]) return SUBJECT_EMOJI_MAP[key];
  return FALLBACK_EMOJIS[hashString(subjectId) % FALLBACK_EMOJIS.length];
}
