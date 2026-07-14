// Thèmes de culture générale proposés en mode Adulte : de quoi explorer
// large plutôt qu'un seul quiz générique, dans l'esprit "prendre son temps".
export type AdultTheme = { name: string; label: string; icon: string };

export const ADULT_THEMES: AdultTheme[] = [
  { name: "Culture générale", label: "Général", icon: "🧠" },
  { name: "Histoire", label: "Histoire", icon: "🏛️" },
  { name: "Géographie", label: "Géographie", icon: "🗺️" },
  { name: "Sciences", label: "Sciences", icon: "🔬" },
  { name: "Arts et littérature", label: "Arts & Litté.", icon: "🎨" },
  { name: "Cinéma et musique", label: "Ciné & Musique", icon: "🎬" },
  { name: "Sport", label: "Sport", icon: "⚽" },
  { name: "Économie", label: "Économie", icon: "📈" },
  { name: "Nature et animaux", label: "Nature", icon: "🌿" },
];
