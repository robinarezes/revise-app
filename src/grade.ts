export const GRADES = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"] as const;
export type Grade = (typeof GRADES)[number];
