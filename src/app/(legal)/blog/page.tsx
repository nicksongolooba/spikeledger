import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
      <header className="border-b border-slate-200 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">
          SpikeLedger Blog
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mt-2 text-slate-900">
          Volleyball coaching, drills &amp; stats
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
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
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 group-hover:text-cyan-700">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {post.excerpt}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cyan-700">
                Read more
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
