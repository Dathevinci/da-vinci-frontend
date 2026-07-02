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
export function parseBio(bio: string | null | undefined, arisePoints: number = 0): { cleanBio: string, backgroundUrl: string | null } {
  if (!bio) {
    return { cleanBio: "", backgroundUrl: null };
  }

  // Regex to match URLs ending in image extensions or specific GIF provider paths
  const urlRegex = /(https?:\/\/[^\s]+(\.(gif|png|jpe?g|webp)|giphy\.com\/media\/|tenor\.com\/view\/)[^\s]*)/i;
  
  const match = bio.match(urlRegex);
  
  if (match) {
    const url = match[0];
    const cleanBio = bio.replace(url, "").trim();
    
    // Only allow background GIFs if they have >= 100 points
    if (arisePoints >= 100) {
      return { cleanBio, backgroundUrl: url };
    } else {
      return { cleanBio, backgroundUrl: null };
    }
  }

  return { cleanBio: bio.trim(), backgroundUrl: null };
}
