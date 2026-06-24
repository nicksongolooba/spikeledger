import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "comparing-liberos-to-hitters",
  title: "The Problem with Comparing Liberos to Hitters",
  metaTitle: "Volleyball Player Evaluation: Liberos vs Hitters",
  metaDescription:
    "Raw stat leaderboards punish players for doing their job. Here's how position-fair volleyball player evaluation works — and what the stats mean.",
  date: "2026-06-10",
  excerpt:
    "Putting a libero and an outside hitter on the same kill leaderboard is like grading a goalkeeper on goals scored — the numbers aren't wrong, the comparison is.",
  keywords: ["volleyball player evaluation", "volleyball stats meaning"],
  related: [
    "how-to-evaluate-volleyball-setters",
    "what-every-volleyball-parent-should-know-about-stats",
    "how-to-track-volleyball-stats-during-a-match",
  ],
  body: `If you have ever posted a team stats sheet after a tournament and watched a libero's row look thin next to the outside hitters, you already understand the core problem with raw volleyball stats meaning. The numbers are accurate. The comparison is broken.

## The Leaderboard Lie

A standard kill leaderboard tells you who terminated the most balls. It tells you nothing about whether those players did their actual jobs well. A libero is not allowed to attack from the front row — so they will never record a kill no matter how dominant they are. A middle blocker rotates to the back row only twice per rotation cycle and rarely passes serve receive at all, so their dig count will naturally be lower than a libero's or outside hitter's even if they are defending perfectly in the rallies they do play.

When you sort players by kills or digs on a single leaderboard, you are not measuring performance. You are measuring role. The libero looks bad because you are grading them on a task they were never asked to do. The middle looks bad in the passing column for the same reason. This is not a minor quibble — it actively misleads you about who is contributing and who needs work.

## What Each Position Is Actually Asked to Do

Position-fair volleyball player evaluation starts by separating the scorecards. Before you judge a number, ask: is this stat even part of this player's job description?

**Libero:** The job is serve receive and back-row defense — full stop. The meaningful numbers are SR average (out of 3) and digs per match. At the 16U level, a solid libero holds an SR average of 2.2 and picks up around 8.5 digs per match. Elite is 2.5 and 12.0 digs. Kills? Completely irrelevant. Not a data gap — just not the job.

**Middle Blocker:** The job is to block and terminate quick attacks efficiently. Middles do not pass serve receive, so their dig counts will always look lean — by design. What matters is blocks per match and hitting efficiency. A solid 16U middle sits around 1.5 blocks per match and a .250 hitting efficiency. Elite is 2.8 blocks and .350 efficiency. Digs? Nice when it happens; not the benchmark.

**Outside Hitter:** The OH is the multi-tool. They pass serve receive, attack from the pin, and cover back row — so they show up in every column. At 16U, a solid outside posts .150 hitting efficiency, a 2.0 SR average, and 5.0 digs per match. Because they touch so many balls, their raw numbers are naturally bigger. Bigger is not automatically better — it is just the consequence of playing more touches per rally.

**Setter:** Their scoreboard is assists, decision quality, and how well they manage their hitters. [Evaluating a setter by kills is as misguided as evaluating a libero that way](/blog/how-to-evaluate-volleyball-setters) — the position's entire output flows through other people's stats.

## The Same Problem, From the Other Direction

It is not only about what players can't do — it is also about volume. An outside hitter on a balanced team might take 30 swing attempts in a match. A middle on the same team might take 12. If the middle hits .300 efficiency on those 12 attempts and the outside hits .200 on 30, the middle made a bigger per-touch contribution, but the outside's raw kill count looks more impressive. Without accounting for attempts and role, you are comparing a starting pitcher to a closer and wondering why the closer has fewer innings.

This is why hitting efficiency exists as a metric: (Kills − Hitting Errors) ÷ Total Attempts. It rewards killing and not erroring, and it scales across different attempt volumes. It is a better tool than raw kills even when you are comparing two players at the same position. Across positions, it still does not solve the libero problem — because efficiency is undefined when you have zero attempts.

## The Bank Account Concept

One framework that handles this cleanly is what you might call a Bank Account approach to player evaluation. The idea is simple: every action a player takes is either a deposit or a withdrawal, and which actions count — and how much — depends on the position.

For a libero, a perfect pass (SR grade 3) is a deposit. A shank is a withdrawal. Digs are deposits. Kills do not exist in their account. For a middle, a stuff block is a deposit. A hitting error is a withdrawal. Passing errors barely register because they are not in the job description. For an outside, the account is wide open — kills, passing grades, digs, and errors all move the balance.

The resulting rating reflects how well each player executed their specific role, not how many total actions they logged. A libero who shanks nothing and grades out a 2.3 SR average might carry a stronger positive balance than a high-volume outside hitter who piles up kills alongside a leaky error rate. The categories in this kind of system — Difference Maker, Reliable, Developing, Needs Focus — mean something because they are compared to position-appropriate standards, not a single universal leaderboard.

SpikeLedger's evaluation is built around this model, which is why a libero's profile and a middle's profile look structurally different rather than being the same template with different numbers plugged in.

## What to Do With This in Practice

The practical shift is small but significant: stop reading the stat sheet left to right and start reading it by role.

When you review your libero's numbers, look at SR average and digs first — and compare them to [libero benchmarks, not team averages](/blog/what-every-volleyball-parent-should-know-about-stats). When you review your middle, look at blocks and hitting efficiency. When your outside is struggling, check whether the problem is in the swing (efficiency), the serve receive (SR average), or the back row (digs) — because any of those three is a legitimate area to address.

Position-fair evaluation does not give anyone a pass for bad play. A libero with a 1.6 SR average at 16U is below the developing threshold of 1.9 and that is real information. A middle with negative hitting efficiency is losing their team points. The framework just makes sure you are measuring the right things before you draw those conclusions.

## One More Thing Worth Saying

The players who play the hardest-to-measure roles tend to be the most vulnerable to bad evaluation. Liberos carry their teams' passing load every single rally and receive the least credit on a raw leaderboard. Middles do invisible work — they jump on every play, front the offense, and drag the opposing middle out of position — work that never appears in any column. If your evaluation system cannot see that work, you will systematically underrate those players, and they will know it.

Getting volleyball stats meaning right is not just about analytics. It is about fairness to the players who do the unglamorous jobs exceptionally well.`,
};
