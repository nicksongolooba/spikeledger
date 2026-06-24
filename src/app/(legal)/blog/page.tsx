import Link from "next/link";
import type { Metadata } from "next";
import { BLOG_POSTS } from "@/content/blog";
import { formatBlogDate, readingTimeMinutes } from "@/content/blog/types";

export const metadata: Metadata = {
  title: "Volleyball Coaching Blog | SpikeLedger",
  description:
    "Drills, practice plans, stat-tracking guides, and position-fair player evaluation - practical volleyball coaching from the SpikeLedger team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Volleyball Coaching Blog | SpikeLedger",
    description:
      "Drills, practice plans, and player-evaluation guides for volleyball coaches.",
    type: "website",
  },
};

export default function BlogIndexPage() {
  return (
    <div>
      <header className="border-b border-slate-800 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-volt-400">
          SpikeLedger Blog
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          Volleyball coaching, drills &amp; stats
        </h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Practical guides for coaches who want to develop players fairly -
          drills by position, practice plans, stat tracking, and what the
          numbers actually mean. Written by coaches, for coaches.
        </p>
      </header>

      <ul className="mt-8 space-y-4">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="card card-hover group block p-5 sm:p-6"
            >
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
                <span aria-hidden>·</span>
                <span>{readingTimeMinutes(post.body)} min read</span>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-100 group-hover:text-volt-300">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {post.excerpt}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-volt-300">
                Read more
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
