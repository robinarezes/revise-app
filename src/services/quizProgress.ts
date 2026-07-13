// Persists in-progress QCM/flashcards runs to localStorage so leaving the
// page (or closing the tab) and coming back resumes instead of restarting.
export function saveProgress<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable: progress just won't resume, not fatal.
  }
}

export function loadProgress<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearProgress(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}
