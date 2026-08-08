export const ADMINS = ['davinci', 'xhackerdevil', 'coffee', 'speyvenerable', 'ash'];
export const LEAD_DEV = 'dejavuh';

// isLeadDev / isAdmin accept EITHER a username string OR a user object.
// The persistent `role` on the account is authoritative — it survives username
// changes. The hardcoded username list is only a fallback (older records, or
// when we only have a name to check, e.g. another user in a list).

export function isLeadDev(u?: any | null): boolean {
  if (!u) return false;
  if (typeof u === 'string') return u.toLowerCase() === LEAD_DEV;
  if (typeof u === 'object') {
    if (u.role === 'LEAD_DEV') return true;
    return (u.username || '').toLowerCase() === LEAD_DEV;
  }
  return false;
}

export function isAdmin(u?: any | null): boolean {
  if (!u) return false;
  if (typeof u === 'string') return ADMINS.includes(u.toLowerCase()) || u.toLowerCase() === LEAD_DEV;
  if (typeof u === 'object') {
    if (u.role === 'ADMIN' || u.role === 'LEAD_DEV') return true;
    if (u.isAdmin) return true;
    const name = (u.username || '').toLowerCase();
    return ADMINS.includes(name) || name === LEAD_DEV;
  }
  return false;
}

// Staff sit outside the economy: the server charges LEAD_DEV and ADMIN alike
// nothing in the shop (cost 0 on purchase and bundle paths), so a finite
// balance for either would be a number that never goes down — a lie with a
// currency symbol. Both display ∞ everywhere.
//
// Admins used to show a fixed 40,000 here, which read as a real (and oddly
// static) balance rather than what it meant.
//
// Pass the user object (preferred) so this reads the persistent role; a bare
// username still works via the fallback list.
export function displayArisePoints(user?: any): string {
  // isAdmin() already includes the lead dev.
  if (isAdmin(user)) return "∞";
  const arisePoints = typeof user === 'object' ? user?.arisePoints : undefined;
  return (arisePoints || 0).toLocaleString();
}

// The lead dev's SHARDS read ∞ too — the server never debits that account
// (isLeadDevFree on every shard sink), so a finite number would be a lie
// that visibly counts down and then snaps back on refresh.
export function displayShards(user: any, shards: number): string {
  if (isLeadDev(user)) return "∞";
  return (shards || 0).toLocaleString();
}
