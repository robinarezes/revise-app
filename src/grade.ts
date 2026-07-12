const KEY = "revise:grade";

export const GRADES = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"] as const;
export type Grade = (typeof GRADES)[number];

export function getGrade(): Grade | null {
  const value = localStorage.getItem(KEY);
  return (GRADES as readonly string[]).includes(value ?? "") ? (value as Grade) : null;
}

export function setGrade(grade: Grade): void {
  localStorage.setItem(KEY, grade);
}
