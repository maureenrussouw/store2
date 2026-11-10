/**
 * Which organization the reader is working in.
 *
 * The API resolves the active organization from X-Organization-ID, and this is
 * where the client remembers which one to send. Set by the organization
 * switcher the multitenant plugin installs; null in a project that has no
 * organizations, in which case no header is sent at all.
 *
 * Per browser, not per account: it is a view preference, and the API verifies
 * membership on every request regardless of what arrives in the header. A
 * forged id gets a 404, not another tenant's data.
 */

const KEY = "grit.active_org";

/**
 * Every listener, so a change reaches the switcher, the query cache and
 * anything else watching without prop-drilling through the layout.
 */
type Listener = (orgID: string | null) => void;
const listeners = new Set<Listener>();

/**
 * Read in memory as well as in storage.
 *
 * Storage can throw (a private window, blocked site data) and can be absent
 * (server rendering), and a client that cannot read it must still send the
 * organization chosen a moment ago in this tab. So the memory copy is the
 * answer and storage is how it survives a reload.
 */
let current: string | null = null;
let loaded = false;

function load(): string | null {
  if (loaded) return current;
  loaded = true;
  if (typeof window === "undefined") return null;
  try {
    current = window.localStorage.getItem(KEY) || null;
  } catch {
    // Private window, blocked site data, or a browser that refuses. The
    // switcher still works for this page's lifetime.
    current = null;
  }
  return current;
}

/** The active organization, or null when the reader has not chosen one. */
export function getActiveOrg(): string | null {
  return load();
}

/**
 * Choose one, or pass null to go back to whatever the API decides.
 *
 * Callers must clear their query cache: every list the reader is looking at
 * was fetched for the previous organization, and showing those rows under a
 * new organization's name is worse than showing nothing. useActiveOrg does
 * that; a caller going direct has to.
 */
export function setActiveOrg(orgID: string | null): void {
  load();
  if (current === orgID) return;
  current = orgID;
  if (typeof window !== "undefined") {
    try {
      if (orgID) window.localStorage.setItem(KEY, orgID);
      else window.localStorage.removeItem(KEY);
    } catch {
      // Not fatal: the choice holds for this page.
    }
  }
  for (const fn of listeners) fn(orgID);
}

/** Watch for a change. Returns the unsubscribe. */
export function subscribeActiveOrg(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
