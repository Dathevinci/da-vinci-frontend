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

// Admins are a fixed, max-level role — they always show a big fixed Arise Points
// balance everywhere (profile, shop, popout) rather than their raw balance. The
// Lead Dev shows ∞.
export const ADMIN_ARISE_POINTS = 40000;

// Pass the user object (preferred) so it can read the role. A bare username
// still works for the ∞/fixed display, just without the balance.
export function displayArisePoints(user?: any): string {
  if (isLeadDev(user)) return "∞";
  if (isAdmin(user)) return ADMIN_ARISE_POINTS.toLocaleString();
  const arisePoints = typeof user === 'object' ? user?.arisePoints : undefined;
  return (arisePoints || 0).toLocaleString();
}
