/**
 * Profile audio — the client-side mirror of the server's gate.
 *
 * The server is the authority (see da-vinci-backend `user.controller.ts` →
 * `checkProfileSong`); this copy exists only to catch a bad link before the
 * round-trip and to power the little preview. AUDIO ONLY — video extensions are
 * absent by design, so a .mp4 link fails here exactly as it does server-side.
 *
 * Keep the two lists in step with the backend allow-list if either changes.
 */

// Shown to the user in the settings helper text — the friendly host name.
export const PROFILE_AUDIO_HOSTS = ["catbox.moe"];
export const PROFILE_AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "flac", "opus"];

// The exact hostnames accepted. catbox is the one host that reliably serves a
// direct, non-expiring audio file (uploads live on files.catbox.moe; the bare
// domain is kept for oddly-formatted links). imgur/postimg host images, not
// audio, so they're deliberately absent — advertising them would only produce
// links that never play.
const ALLOWED_HOSTS = new Set([
  "files.catbox.moe",
  "catbox.moe",
]);

export function validateProfileAudio(
  raw: string
): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: false, message: "Paste an audio link first." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: "That doesn't look like a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, message: "Audio links must start with https://." };
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, message: "Host not allowed — upload to catbox.moe and paste the files.catbox.moe link." };
  }
  const path = url.pathname.toLowerCase();
  if (!PROFILE_AUDIO_EXTS.some((ext) => path.endsWith("." + ext))) {
    return {
      ok: false,
      message: "Audio only — the link must end in .mp3, .wav, .ogg, .m4a, .flac, or .opus.",
    };
  }
  return { ok: true, value: trimmed };
}
