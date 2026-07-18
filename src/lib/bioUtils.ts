/**
 * Parses a user's bio to extract any GIF/Image URLs.
 * If the user has >= 100 Arise Points, the first media URL is extracted as a background image,
 * and the URL is stripped from the display text.
 * If the user has < 100 Arise Points, the URL is stripped but not used as a background.
 *
 * @param bio The raw bio string
 * @param arisePoints The user's Arise Points
 * @returns { cleanBio: string, backgroundUrl: string | null }
 */
import { isAdmin } from "./admin";

export function parseBio(bio: string | null | undefined, arisePoints: number = 0, username: string = ""): { cleanBio: string, backgroundUrl: string | null } {
  if (!bio) {
    return { cleanBio: "", backgroundUrl: null };
  }

  // Auto-transform Giphy webpage links to direct media URLs
  const giphyWebRegex = /https?:\/\/giphy\.com\/gifs\/[^\s]+?-([a-zA-Z0-9]+)(?:\?.*)?/i;
  let parsedBio = bio;
  const giphyMatch = bio.match(giphyWebRegex);
  if (giphyMatch) {
    const id = giphyMatch[1];
    const directUrl = `https://media.giphy.com/media/${id}/giphy.gif`;
    parsedBio = bio.replace(giphyMatch[0], directUrl);
  }

  // Regex to match direct image URLs (must end in image ext or be a known media provider raw URL)
  const urlRegex = /(https?:\/\/[^\s]+(\.(gif|png|jpe?g|webp)|media\.giphy\.com\/media\/)[^\s]*)/i;
  
  const match = parsedBio.match(urlRegex);
  
  if (match) {
    const url = match[0];
    const cleanBio = parsedBio.replace(url, "").trim();
    
    const isSpecial = isAdmin(username);

    // Only allow background GIFs if they have >= 100 points or are a special user
    if (arisePoints >= 100 || isSpecial) {
      return { cleanBio, backgroundUrl: url };
    } else {
      return { cleanBio, backgroundUrl: null };
    }
  }

  return { cleanBio: parsedBio.trim(), backgroundUrl: null };
}
