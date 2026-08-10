/**
 * /guilds/:id — an alias for the guild home at /guild/:id.
 *
 * The backend's notification deep links (commentDeepLink in
 * comment.controller.ts) send guild-board mentions and replies to
 * `/guilds/<id>?comment=…`, and "the plural is also a detail route" is a
 * natural guess for anyone typing a URL. Both segments are named [id], so the
 * one page component reads its param identically from either route.
 */
export { default } from "../../guild/[id]/page";
