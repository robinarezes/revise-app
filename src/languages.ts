export const LANGUAGES = [
  "Anglais",
  "Espagnol",
  "Allemand",
  "Italien",
  "Portugais",
  "Chinois",
  "Arabe",
  "Russe",
] as const;
export type Language = (typeof LANGUAGES)[number];
