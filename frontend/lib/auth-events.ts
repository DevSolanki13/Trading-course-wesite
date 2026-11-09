export const AUTH_CHANGE_KEY = "indianxtrade-auth-change";

/** A cross-tab invalidation signal only; never persist user data, cookies or tokens. */
export function notifyAuthChange() {
  try {
    localStorage.setItem(AUTH_CHANGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Storage may be unavailable. Navigation and focus still verify the cookie session.
  }
}
