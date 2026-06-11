// Public invite landing page. Signed-in users join in one tap; new users go
// to register with the code attached (register auto-joins after signup).

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JoinClubButton } from "./JoinClubButton";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { code: string };
}) {
  const invite = await prisma.clubInvite.findUnique({
    where: { code: params.code },
    include: {
      club: {
        select: { id: true, name: true, _count: { select: { members: true } } },
      },
    },
  });

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const invalid =
    !invite || Boolean(invite.acceptedAt) || invite.expiresAt < new Date();

  const alreadyMember =
    invite && userId
      ? Boolean(
          await prisma.clubMember.findFirst({
            where: { userId, clubId: invite.clubId },
            select: { id: true },
          }),
        )
      : false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold-400/10 text-2xl">
          🏐
        </div>
        {invalid ? (
          <>
            <h1 className="text-xl font-bold text-slate-100">
              This invite isn&apos;t valid
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              The link may have expired or already been used. Ask your club
              owner to send a fresh invite.
            </p>
            <Link href="/" className="btn-secondary mt-6 inline-flex">
              Back to SpikeLedger
            </Link>
          </>
        ) : alreadyMember ? (
          <>
            <h1 className="text-xl font-bold text-slate-100">
              You&apos;re already in {invite!.club.name}
            </h1>
            <Link href="/club" className="btn-primary mt-6 inline-flex">
              Go to your club
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-100">
              Join {invite!.club.name} on SpikeLedger
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              You&apos;ve been invited to coach with{" "}
              <span className="font-semibold text-slate-200">
                {invite!.club.name}
              </span>
              . You&apos;ll see the club&apos;s teams and get full Coach Pro
              features through the club&apos;s plan.
            </p>
            {userId ? (
              <JoinClubButton code={params.code} />
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  href={`/register?invite=${encodeURIComponent(params.code)}`}
                  className="btn-primary w-full"
                >
                  Create an account &amp; join
                </Link>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/invite/${params.code}`)}`}
                  className="btn-secondary w-full"
                >
                  I already have an account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
