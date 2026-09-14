// Minimal, dependency-free markdown renderer for blog posts. Supports the
// subset the posts are authored in: ## / ### headings, paragraphs, "- " and
// "1. " lists, "> " blockquotes, **bold**, and [text](url) links. Content is
// hardcoded (author-controlled), so there is no untrusted-HTML concern.

import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// Slugify a heading to an anchor id.
function anchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Inline parsing: **bold** and [text](url). Returns an array of React nodes.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize on **bold** and [label](href) in one pass.
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-slate-900">
          {m[1]}
        </strong>,
      );
    } else {
      const label = m[2];
      const href = m[3];
      const external = /^https?:\/\//.test(href);
      if (external) {
        nodes.push(
          <a
            key={`${keyPrefix}-l-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-cyan-700 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-800"
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(
          <Link
            key={`${keyPrefix}-l-${i}`}
            href={href}
            className="font-medium text-cyan-700 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-800"
          >
            {label}
          </Link>,
        );
      }
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

interface Block {
  type: "h2" | "h3" | "p" | "ul" | "ol" | "quote";
  lines: string[];
}

function parseBlocks(md: string): Block[] {
  const rawLines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", lines: [para.join(" ")] });
      para = [];
    }
  };
  for (let idx = 0; idx < rawLines.length; idx++) {
    const line = rawLines[idx];
    const trimmed = line.trim();
    if (trimmed === "") {
      flushPara();
      continue;
    }
    // Horizontal rule (--- or ***): treat as a section break, render nothing.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushPara();
      blocks.push({ type: "h3", lines: [trimmed.slice(4)] });
    } else if (trimmed.startsWith("## ")) {
      flushPara();
      blocks.push({ type: "h2", lines: [trimmed.slice(3)] });
    } else if (trimmed.startsWith("> ")) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last && last.type === "quote") last.lines.push(trimmed.slice(2));
      else blocks.push({ type: "quote", lines: [trimmed.slice(2)] });
    } else if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      const item = trimmed.replace(/^[-*]\s+/, "");
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.lines.push(item);
      else blocks.push({ type: "ul", lines: [item] });
    } else if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      const item = trimmed.replace(/^\d+\.\s+/, "");
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ol") last.lines.push(item);
      else blocks.push({ type: "ol", lines: [item] });
    } else {
      para.push(trimmed);
    }
  }
  flushPara();
  return blocks;
}

export function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-5 text-[15px] leading-relaxed text-slate-700 sm:text-base">
      {blocks.map((b, i) => {
        const key = `blk-${i}`;
        switch (b.type) {
          case "h2":
            return (
              <h2
                key={key}
                id={anchorId(b.lines[0])}
                className="font-display text-2xl font-bold tracking-tight scroll-mt-24 pt-4 text-slate-900"
              >
                {renderInline(b.lines[0], key)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={key}
                id={anchorId(b.lines[0])}
                className="font-display text-lg font-bold scroll-mt-24 pt-2 text-slate-900"
              >
                {renderInline(b.lines[0], key)}
              </h3>
            );
          case "ul":
            return (
              <ul key={key} className="ml-1 space-y-2">
                {b.lines.map((li, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-200" />
                    <span>{renderInline(li, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="ml-1 space-y-2">
                {b.lines.map((li, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="stat-number mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-cyan-700">
                      {j + 1}
                    </span>
                    <span>{renderInline(li, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-cyan-300 bg-white/40 py-2 pl-4 pr-3 italic text-slate-700"
              >
                {b.lines.map((q, j) => (
                  <Fragment key={j}>{renderInline(q, `${key}-${j}`)} </Fragment>
                ))}
              </blockquote>
            );
          default:
            return (
              <p key={key}>{renderInline(b.lines[0], key)}</p>
            );
        }
      })}
    </div>
  );
}
