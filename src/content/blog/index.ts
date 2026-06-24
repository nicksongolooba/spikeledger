// Blog registry. Each post is a hardcoded module under ./posts; this file is
// the single source of truth for ordering, lookup, and related-post resolution.

import type { BlogPost } from "./types";
import { post as p1 } from "./posts/best-volleyball-drills-for-every-position";
import { post as p2 } from "./posts/how-to-track-volleyball-stats-during-a-match";
import { post as p3 } from "./posts/volleyball-practice-plans-that-actually-work";
import { post as p4 } from "./posts/comparing-liberos-to-hitters";
import { post as p5 } from "./posts/volleyball-serve-receive-drills-for-youth-teams";
import { post as p6 } from "./posts/how-to-run-volleyball-tryouts";
import { post as p7 } from "./posts/understanding-volleyball-rotations";
import { post as p8 } from "./posts/volleyball-blocking-drills";
import { post as p9 } from "./posts/what-every-volleyball-parent-should-know-about-stats";
import { post as p10 } from "./posts/youth-volleyball-coaching-tips-for-first-year-coaches";
import { post as p11 } from "./posts/how-to-evaluate-volleyball-setters";
import { post as p12 } from "./posts/volleyball-hitting-efficiency-explained";
import { post as p13 } from "./posts/how-to-give-volleyball-players-feedback";
import { post as p14 } from "./posts/free-volleyball-stats-app-what-to-look-for";
import { post as p15 } from "./posts/end-of-season-volleyball-report-cards";

// Newest first.
export const BLOG_POSTS: BlogPost[] = [
  p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15,
].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return BLOG_POSTS.map((p) => p.slug);
}

// Resolve a post's 3 related slugs to posts (skipping any that don't exist),
// backfilling with the most recent other posts if needed.
export function getRelatedPosts(slug: string): BlogPost[] {
  const post = getPostBySlug(slug);
  if (!post) return [];
  const out: BlogPost[] = [];
  for (const rel of post.related) {
    const found = getPostBySlug(rel);
    if (found && found.slug !== slug && !out.includes(found)) out.push(found);
  }
  for (const p of BLOG_POSTS) {
    if (out.length >= 3) break;
    if (p.slug !== slug && !out.includes(p)) out.push(p);
  }
  return out.slice(0, 3);
}
