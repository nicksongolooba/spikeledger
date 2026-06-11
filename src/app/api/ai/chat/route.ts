// POST /api/ai/chat - the "Ask Coach AI" assistant. Coach Pro / Club feature,
// powered by Claude. Loads the full team dataset into the system prompt and
// answers natural-language questions with the conversation history attached.
// Daily message caps are enforced per user via the ChatUsage table.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserPerformAction, PLAN_LIMITS } from "@/lib/plan-limits";
import { getAnthropicClient, CLAUDE_MODEL } from "@/engine/ai/providers";
import { buildChatContext, type ChatFocus } from "@/engine/ai/chat-context";

const UNAVAILABLE = "AI chat is temporarily unavailable. Try again in a moment.";

const BodySchema = z.object({
  teamId: z.string().min(1),
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(24)
    .default([]),
  context: z
    .object({
      type: z.enum(["tournament", "player", "match"]),
      id: z.string().min(1),
    })
    .optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const team = await prisma.team.findFirst({
    where: { id: parsed.data.teamId, coachId: userId },
    select: { id: true, name: true, season: true, ageGroup: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // Plan gating - chat is Coach Pro and up.
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const check = canUserPerformAction(me.plan, "coach-chat");
  if (!check.allowed) {
    return NextResponse.json(
      {
        error: check.reason?.reason ?? "Ask Coach AI requires Coach Pro.",
        upgradeReason: check.reason,
      },
      { status: 402 },
    );
  }

  // Daily rate limit - one atomic upsert+increment, then check. Decremented
  // below if the model call fails, so failed requests don't burn quota.
  const limit = PLAN_LIMITS[me.plan].chatMessagesPerDay;
  const day = new Date().toISOString().slice(0, 10);
  const usage = await prisma.chatUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (usage.count > limit) {
    return NextResponse.json(
      {
        error: `You've used all ${limit} chat messages for today. Your limit resets at midnight UTC.`,
        remaining: 0,
      },
      { status: 429 },
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }

  const focus: ChatFocus = parsed.data.context
    ? ({ type: parsed.data.context.type, id: parsed.data.context.id } as ChatFocus)
    : { type: "team" };

  try {
    const { systemPrompt, sources } = await buildChatContext(team, focus);

    // 2048 leaves room for a full practice plan (5 phases x drill blocks).
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        ...parsed.data.history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: parsed.data.message },
      ],
    });

    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new Error("Claude returned no content");

    return NextResponse.json({
      response: text,
      sources,
      remaining: Math.max(0, limit - usage.count),
    });
  } catch (err) {
    console.error("[ai/chat] failed:", err);
    // Refund the message - the coach got nothing for it.
    await prisma.chatUsage
      .update({
        where: { userId_day: { userId, day } },
        data: { count: { decrement: 1 } },
      })
      .catch(() => {});
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
}
