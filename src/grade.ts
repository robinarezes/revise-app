export const GRADES = [
  "CP",
  "CE1",
  "CE2",
  "CM1",
  "CM2",
  "6e",
  "5e",
  "4e",
  "3e",
  "2nde",
  "1ère",
  "Terminale",
] as const;
export type Grade = (typeof GRADES)[number];

export const KIDS_GRADES: readonly Grade[] = ["CP", "CE1", "CE2", "CM1", "CM2"];
