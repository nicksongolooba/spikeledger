// Public invite landing page. Signed-in users join in one tap; new users go
// to register with the code attached (register auto-joins after signup).

import Link from "next/link";
import { Volleyball } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isClubActive } from "@/lib/club";
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

  // A link written while the club was paid for should not lead someone into a
  // dormant club, where joining would grant nothing and explain nothing.
  const dormant = !invalid && invite ? !(await isClubActive(invite.clubId)) : false;

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
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-navy-950">
          <Volleyball size={24} strokeWidth={2.25} aria-hidden />
        </div>
        {invalid ? (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
              This invite isn&apos;t valid
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              The link may have expired or already been used. Ask your club
              owner to send a fresh invite.
            </p>
            <Link href="/" className="btn-secondary mt-6 inline-flex">
              Back to SpikeLedger
            </Link>
          </>
        ) : dormant ? (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
              {invite!.club.name} isn&apos;t active right now
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              This club&apos;s plan has lapsed, so the invite can&apos;t be used
              yet. Nothing has been lost. Once the club owner subscribes again,
              ask them to resend this link.
            </p>
            <Link href="/" className="btn-secondary mt-6 inline-flex">
              Back to SpikeLedger
            </Link>
          </>
        ) : alreadyMember ? (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
              You&apos;re already in {invite!.club.name}
            </h1>
            <Link href="/club" className="btn-primary mt-6 inline-flex">
              Go to your club
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
              Join {invite!.club.name} on SpikeLedger
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              You&apos;ve been invited to coach with{" "}
              <span className="font-semibold text-slate-800">
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
