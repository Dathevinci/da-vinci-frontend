import { authHeaders } from "./authToken";

/**
 * Thin client for the Lead Dev console API (/api/console/*).
 *
 * Every one of these endpoints is gated server-side with
 * requireStaff(req, res, { leadDevOnly: true }) — an ADMIN token gets a 403 just
 * like an anonymous request. The UI gate is convenience; this is not where the
 * security lives.
 *
 * Never throws on a failed request: the backend already returns
 * { success:false, message } for 4xx, and a thrown network error becomes the
 * same shape, so callers only ever branch on `.success`.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type ConsoleResult<T = any> = { success: boolean; data?: T; message?: string };

async function request<T = any>(
  path: string,
  init: { method?: string; body?: any } = {}
): Promise<ConsoleResult<T>> {
  try {
    const res = await fetch(`${API_URL}/api/console${path}`, {
      method: init.method || "GET",
      headers: authHeaders(),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    // A 401/403 still returns JSON from this API, but guard anyway — an HTML
    // error page from a proxy would otherwise throw inside .json().
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      return { success: false, message: `Request failed (${res.status}).` };
    }
    if (!json || typeof json !== "object") return { success: false, message: "Unexpected response." };
    return json as ConsoleResult<T>;
  } catch {
    return { success: false, message: "Network error — is the backend awake?" };
  }
}

export const consoleApi = {
  me: () => request("/me"),

  // Users
  listUsers: (qs: string) => request(`/users${qs}`),
  dossier: (id: string) => request(`/users/${id}`),
  setRole: (id: string, body: any) => request(`/users/${id}/role`, { method: "POST", body }),
  adjustPoints: (id: string, body: any) => request(`/users/${id}/points`, { method: "POST", body }),
  grantItem: (id: string, body: any) => request(`/users/${id}/grant-item`, { method: "POST", body }),
  revokeItem: (id: string, body: any) => request(`/users/${id}/revoke-item`, { method: "POST", body }),
  notify: (id: string, body: any) => request(`/users/${id}/notify`, { method: "POST", body }),
  deleteUser: (id: string, body: any) => request(`/users/${id}`, { method: "DELETE", body }),

  // Economy
  economyOverview: () => request("/economy/overview"),
  ledger: (qs: string) => request(`/economy/ledger${qs}`),
  reverseEntry: (id: string, body: any) => request(`/economy/ledger/${id}/reverse`, { method: "POST", body }),
  catalog: () => request("/shop/catalog"),

  // Ops
  opsStatus: () => request("/ops/status"),
  setMaintenance: (body: any) => request("/ops/maintenance", { method: "POST", body }),
  listInvites: (qs: string) => request(`/ops/invites${qs}`),
  createInvites: (body: any) => request("/ops/invites", { method: "POST", body }),
  revokeInvite: (id: string) => request(`/ops/invites/${id}`, { method: "DELETE" }),
  publishAnnouncement: (body: any) => request("/ops/announcements", { method: "POST", body }),

  // Moderation + insights + audit
  listComments: (qs: string) => request(`/moderation/comments${qs}`),
  deleteComment: (id: string, body: any) => request(`/moderation/comments/${id}`, { method: "DELETE", body }),
  pinComment: (id: string, body: any) => request(`/moderation/comments/${id}/pin`, { method: "POST", body }),
  insights: () => request("/insights"),
  audit: (qs: string) => request(`/audit${qs}`),
};
