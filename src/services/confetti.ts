// Petite pluie de confettis en CSS pur (pas de librairie) pour les paliers
// importants (montée de niveau, série de 7 jours, etc.).
const COLORS = ["#58CC02", "#1CB0F6", "#FFC800", "#CE82FF", "#FF4B4B", "#FF9600"];

export function triggerConfetti(count = 60): void {
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const color = COLORS[i % COLORS.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.3;
    const duration = 1.6 + Math.random() * 1.2;
    const size = 6 + Math.random() * 6;
    const rotateStart = Math.random() * 360;
    piece.style.cssText = `
      position:absolute;
      top:-20px;
      left:${left}vw;
      width:${size}px;
      height:${size * 0.6}px;
      background:${color};
      opacity:0.9;
      border-radius:2px;
      transform:rotate(${rotateStart}deg);
      animation:confetti-fall ${duration}s ease-in ${delay}s forwards;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 3200);
}
