// Builds a YouTube *search* URL (never a direct video URL) from a drill query.
// Search links always resolve to real, current videos, so the AI only needs to
// supply plain search terms - we never trust it to produce a real video ID.

export function youtubeSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "";
  const phrase = q.toLowerCase().startsWith("volleyball") ? q : `volleyball ${q}`;
  const terms = phrase.split(/\s+/).map(encodeURIComponent).join("+");
  return `https://www.youtube.com/results?search_query=${terms}`;
}
