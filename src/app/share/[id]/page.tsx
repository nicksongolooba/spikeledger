import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Wordmark } from "@/components/layout/Wordmark";
import { prisma } from "@/lib/prisma";
import {
  SHARE_EXPIRED_BODY,
  SHARE_EXPIRED_HEADLINE,
  publicPlayerName,
  shareState,
} from "@/lib/share-links";

// Public, no login. Everything here is written on the assumption that the URL
// has been forwarded to someone it was never meant for:
//   - noindex, nofollow on every response, expired ones included, so a link
//     posted in a public place cannot end up in a search result
//   - the page stops working 30 days after it was made, or the moment the
//     coach revokes it
//   - a first name and a jersey number, never a full name, in the heading, the
//     tab title and the link preview
export const dynamic = "force-dynamic";

// Applies to the report page and the expired notice alike.
const NO_INDEX = { index: false, follow: false, nocache: true } as const;

interface ShareMeta {
  playerId?: string;
  playerName?: string;
  teamName?: string;
  scopeLabel?: string;
  labels?: string[];
  keys?: string[];
}

async function loadShare(id: string) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return null;
  const meta = (report.metadata as unknown as ShareMeta) ?? {};
  const state = shareState(report);
  // The safe name is derived from the player record at render time, so a
  // report saved before this rule existed is still shown safely.
  const player = meta.playerId
    ? await prisma.player.findUnique({
        where: { id: meta.playerId },
        select: { name: true, number: true },
      })
    : null;
  const displayName = player
    ? publicPlayerName(player.name, player.number)
    : publicPlayerName(meta.playerName, null);
  return { report, meta, state, displayName };
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const found = await loadShare(params.id);
  if (!found) return { title: "Report not found · SpikeLedger", robots: NO_INDEX };
  if (found.state !== "active") {
    return { title: "Report link expired · SpikeLedger", robots: NO_INDEX };
  }
  const { meta, displayName } = found;
  const title = `${displayName} · ${meta.scopeLabel ?? "Report"}`;
  const description = `A SpikeLedger performance report for ${displayName}${
    meta.scopeLabel ? ` from ${meta.scopeLabel}` : ""
  }.`;
  return {
    title,
    description,
    robots: NO_INDEX,
    openGraph: {
      title,
      description,
      images: [`/api/reports/${params.id}/og`],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/reports/${params.id}/og`],
    },
  };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const found = await loadShare(params.id);
  if (!found) notFound();
  const { report, meta, state, displayName } = found;

  if (state !== "active") return <ExpiredNotice />;

  const labels = meta.labels ?? report.imageUrls.map((_, i) => `Image ${i + 1}`);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1 text-xs font-medium text-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            Match report
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl mt-4 text-slate-900">
            {displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {meta.teamName ? `${meta.teamName} · ` : ""}
            {meta.scopeLabel ?? "Season"}
          </p>
        </header>

        <div className="mt-10 space-y-6">
          {report.imageUrls.map((url, i) => (
            <figure key={i} className="overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={labels[i] ?? `Image ${i + 1}`}
                className="block w-full"
              />
              <figcaption className="bg-white px-4 py-2 text-center text-xs text-slate-600">
                {labels[i] ?? `Image ${i + 1}`}
              </figcaption>
            </figure>
          ))}
        </div>

        <ShareFooter />
      </div>
    </div>
  );
}

// Deliberately says nothing about who the report was for or whether the link
// was ever real. Someone who should not have the link learns nothing from it.
function ExpiredNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
        <div className="mb-4 flex justify-center">
          <Wordmark size="sm" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          {SHARE_EXPIRED_HEADLINE}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{SHARE_EXPIRED_BODY}</p>
      </div>
    </div>
  );
}

function ShareFooter() {
  return (
    <footer className="mt-14 border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
      <div className="mb-3 flex justify-center">
        <Wordmark size="sm" />
      </div>
      <p className="mb-3 text-xs text-slate-500">
        This link expires automatically, and the coach can turn it off at any time.
      </p>
      <span className="font-medium text-slate-700">Powered by SpikeLedger</span> - free for
      coaches at{" "}
      <a href="/" className="text-cyan-700 hover:text-cyan-800">
        spikeledger.app
      </a>
    </footer>
  );
}
