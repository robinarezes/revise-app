const KEY = "revise:visitor_id";

// Anonymous per-browser id used only to enforce the free daily quota on the
// backend. Not an account system — clearing site data resets it.
export function getVisitorId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
