// The signed session JWT issued by the backend on login/signup. Stored next to
// the cached user; sent as `Authorization: Bearer <token>` on sensitive
// mutations so the server can verify WHO is acting (not trust a client id).
//
// NOTE: this is a real JWT — do NOT reuse it for the legacy invite endpoints,
// which expect `Bearer <rawUserId>`. Only the calls wired here send the JWT.
export const TOKEN_KEY = "davinci_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

// Headers for an authenticated JSON request. Adds the Bearer token when present;
// falls back to plain JSON (grandfathered pre-JWT session) when it isn't.
export function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...base,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
