// Doit rester identique à api/_lib/date.ts : "aujourd'hui" se calcule à
// minuit heure de Paris, pas minuit UTC, sinon le quiz du jour et le
// classement changent avec des heures de décalage par rapport à ce que
// l'utilisateur voit comme "aujourd'hui".
export function todayParis(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}
