// A blog post is hardcoded data (no CMS). The body is authored in a small
// markdown subset rendered by components/blog/Markdown.tsx: ## / ### headings,
// paragraphs, - and 1. lists, > blockquotes, **bold**, and [text](url) links.

export interface BlogPost {
  slug: string;
  title: string; // rendered as the H1
  metaTitle: string; // <head> <title>, under 60 chars
  metaDescription: string; // meta description, under 155 chars
  date: string; // ISO yyyy-mm-dd (publish date)
  excerpt: string; // one-line summary for the listing + OG fallback
  keywords: string[];
  related: [string, string, string]; // exactly 3 related post slugs
  body: string; // markdown
}

export const BLOG_AUTHOR = "SpikeLedger Team";

// ~200 words/min, rounded up, floor of 1.
export function readingTimeMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Format an ISO yyyy-mm-dd date without timezone drift (no Date parsing).
export function formatBlogDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
