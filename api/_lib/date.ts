// "Aujourd'hui" côté serveur doit correspondre à minuit heure de Paris (le
// public visé), pas minuit UTC : sinon le quiz du jour/quota/série changent
// avec plusieurs heures de décalage par rapport à ce que l'utilisateur voit
// comme "aujourd'hui".
export function todayParis(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);
}
