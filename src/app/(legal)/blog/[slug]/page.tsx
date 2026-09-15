import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllSlugs, getRelatedPosts } from "@/content/blog";
import {
  BLOG_AUTHOR,
  formatBlogDate,
  readingTimeMinutes,
} from "@/content/blog/types";
import { Markdown } from "@/components/blog/Markdown";
import { BlogCTA } from "@/components/blog/BlogCTA";
import headerPhoto from "@/assets/photos/player-set-wide.jpg";

const HEADER_ALT = "A setter reaching for the ball at the net, with the stands behind";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://www.spikeledger.com";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Post not found | SpikeLedger" };
  const url = `${BASE}/blog/${post.slug}`;
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      type: "article",
      url,
      publishedTime: post.date,
      authors: [BLOG_AUTHOR],
      images: [{ url: `${BASE}${headerPhoto.src}`, width: headerPhoto.width, height: headerPhoto.height, alt: HEADER_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.metaDescription,
      images: [`${BASE}${headerPhoto.src}`],
    },
  };
}

export default function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();
  const related = getRelatedPosts(post.slug);
  const readTime = readingTimeMinutes(post.body);

  return (
    <article>
      {/* Article structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.metaDescription,
            datePublished: post.date,
            dateModified: post.date,
            author: { "@type": "Organization", name: BLOG_AUTHOR },
            publisher: { "@type": "Organization", name: "SpikeLedger" },
            mainEntityOfPage: `${BASE}/blog/${post.slug}`,
            keywords: post.keywords.join(", "),
          }),
        }}
      />

      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/blog" className="inline-flex items-center gap-1 font-medium hover:text-slate-900">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          All posts
        </Link>
      </nav>

      <header className="border-b border-slate-200 pb-6">
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-lg bg-navy-900">
          <Image
            src={headerPhoto}
            alt={HEADER_ALT}
            fill
            priority
            placeholder="blur"
            sizes="(min-width: 768px) 736px, 100vw"
            className="object-cover"
          />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
          {post.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="font-medium text-slate-600">{BLOG_AUTHOR}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
          <span aria-hidden>·</span>
          <span>{readTime} min read</span>
        </div>
      </header>

      <div className="mt-8">
        <Markdown content={post.body} />
      </div>

      <BlogCTA />

      {related.length > 0 && (
        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Related reading
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/blog/${r.slug}`}
                  className="card card-hover group flex h-full flex-col p-4"
                >
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700">
                    {r.title}
                  </span>
                  <span className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">
                    {r.excerpt}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
