// Chaque matière reçoit un dégradé de deux couleurs (pas juste une teinte
// plate) pour son icône, choisi de façon stable à partir de son nom/id.
const SUBJECT_GRADIENTS: [string, string][] = [
  ["#1CB0F6", "#0D8ECF"], // bleu
  ["#FF4B4B", "#E63E3E"], // rouge
  ["#58CC02", "#3E9E00"], // vert
  ["#FFC800", "#E6A400"], // jaune
  ["#CE82FF", "#A568CC"], // violet
  ["#FF9600", "#E67E00"], // orange
  ["#FF86D0", "#E667B0"], // rose
  ["#2B70C9", "#1E56A0"], // bleu foncé
  ["#00C2A8", "#00A088"], // turquoise
  ["#FF6B6B", "#E44F4F"], // corail
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function colorForSubject(subjectId: string): string {
  return SUBJECT_GRADIENTS[hashString(subjectId) % SUBJECT_GRADIENTS.length][0];
}

export function gradientForSubject(subjectId: string): string {
  const [a, b] = SUBJECT_GRADIENTS[hashString(subjectId) % SUBJECT_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

const SUBJECT_EMOJI_MAP: Record<string, string> = {
  maths: "🧮",
  mathematiques: "🧮",
  "mathématiques": "🧮",
  histoire: "🏛️",
  "géographie": "🌍",
  geographie: "🌍",
  "histoire-géographie": "🗺️",
  "histoire-geographie": "🗺️",
  emc: "🤝",
  "enseignement moral et civique": "🤝",
  francais: "📖",
  "français": "📖",
  litterature: "✒️",
  "littérature": "✒️",
  latin: "🏺",
  grec: "🏺",
  anglais: "🇬🇧",
  espagnol: "🇪🇸",
  allemand: "🇩🇪",
  italien: "🇮🇹",
  portugais: "🇵🇹",
  chinois: "🇨🇳",
  japonais: "🇯🇵",
  russe: "🇷🇺",
  arabe: "🇸🇦",
  svt: "🌱",
  biologie: "🌱",
  "sciences de la vie et de la terre": "🌱",
  physique: "⚛️",
  chimie: "🧪",
  "physique-chimie": "⚛️",
  philosophie: "🦉",
  sport: "⚽",
  eps: "⚽",
  "éducation physique et sportive": "⚽",
  musique: "🎵",
  "éducation musicale": "🎵",
  arts: "🎨",
  "arts plastiques": "🎨",
  "histoire des arts": "🖼️",
  theatre: "🎭",
  "théâtre": "🎭",
  technologie: "⚙️",
  "économie": "📈",
  economie: "📈",
  "sciences économiques et sociales": "📈",
  ses: "📈",
  informatique: "💻",
  "numérique et sciences informatiques": "💻",
  nsi: "💻",
  droit: "⚖️",
  medecine: "🩺",
  "médecine": "🩺",
  "questionner le monde": "🔎",
};

const FALLBACK_EMOJIS = ["📘", "📗", "📙", "📕", "📓", "📔", "📒"];

export function emojiForSubject(name: string, subjectId: string): string {
  const key = name.trim().toLowerCase();
  if (SUBJECT_EMOJI_MAP[key]) return SUBJECT_EMOJI_MAP[key];
  return FALLBACK_EMOJIS[hashString(subjectId) % FALLBACK_EMOJIS.length];
}
