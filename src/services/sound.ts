// Petits sons de feedback synthétisés (pas de fichiers audio à charger),
// jouables offline, coupables depuis les Réglages.

const STORAGE_KEY = "revise:sound_enabled";
let ctx: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, startOffset: number, duration: number, gainPeak: number, type: OscillatorType) {
  const audio = getContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function play(notes: { freq: number; at: number; dur: number; gain?: number; type?: OscillatorType }[]) {
  if (!isSoundEnabled()) return;
  for (const n of notes) tone(n.freq, n.at, n.dur, n.gain ?? 0.12, n.type ?? "sine");
}

export function playCorrect(): void {
  play([
    { freq: 587.33, at: 0, dur: 0.12 },
    { freq: 880, at: 0.09, dur: 0.18 },
  ]);
}

export function playWrong(): void {
  play([{ freq: 196, at: 0, dur: 0.28, type: "triangle", gain: 0.1 }]);
}

export function playComplete(): void {
  play([
    { freq: 523.25, at: 0, dur: 0.14 },
    { freq: 659.25, at: 0.1, dur: 0.14 },
    { freq: 783.99, at: 0.2, dur: 0.14 },
    { freq: 1046.5, at: 0.3, dur: 0.3 },
  ]);
}

export function playTap(): void {
  play([{ freq: 440, at: 0, dur: 0.05, gain: 0.05 }]);
}
