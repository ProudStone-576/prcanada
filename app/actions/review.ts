"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireReviewer } from "@/lib/roles";
import { UPDATE_KINDS } from "@/lib/updates";


const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const updateSchema = z
  .object({
    kind: z.enum(UPDATE_KINDS),
    title: z.string().trim().min(8).max(160),
    summary: z.string().trim().min(20).max(1200),
    jurisdiction: z.string().trim().min(2).max(120),
    sourceUrl: z.string().url().refine((u) => u.startsWith("https://"), "Use the official https page"),
    announcedOn: date,
    effectiveOn: date,
    status: z.enum(["announced", "in_effect", "ended"]),
  })
  .superRefine((v, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (v.status === "in_effect" && (!v.effectiveOn || v.effectiveOn > today)) {
      ctx.addIssue({ code: "custom", path: ["effectiveOn"], message: "An update can only be marked in effect once its effective date has passed. Publish it as announced instead." });
    }
    if (v.status === "announced" && v.effectiveOn && v.effectiveOn <= today) {
      ctx.addIssue({ code: "custom", path: ["status"], message: "The effective date has passed. Confirm on the official page that it took effect, then mark it in effect." });
    }
  });

export async function dismissReviewAction(id: string, note: string) {
  const user = await requireReviewer();
  await db.reviewItem.updateMany({ where: { id, status: "pending" }, data: { status: "dismissed", reviewedBy: user.email, reviewedAt: new Date(), note: note.slice(0, 500) || null } });
  await audit("review_dismissed", user.id);
  revalidatePath("/review");
}

export async function publishUpdateAction(reviewId: string | null, input: z.input<typeof updateSchema>): Promise<{ error: string | null }> {
  const user = await requireReviewer();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const toDate = (s?: string) => (s ? new Date(s + "T00:00:00Z") : null);
  const update = await db.$transaction(async (tx) => {
    const u = await tx.updateItem.create({
      data: { reviewId, kind: v.kind, title: v.title, summary: v.summary, jurisdiction: v.jurisdiction, sourceUrl: v.sourceUrl, announcedOn: toDate(v.announcedOn), effectiveOn: toDate(v.effectiveOn), status: v.status, publishedBy: user.email },
    });
    if (reviewId) await tx.reviewItem.update({ where: { id: reviewId }, data: { status: "published", reviewedBy: user.email, reviewedAt: new Date() } });
    return u;
  });
  // Tell every user in the app; updates are never emailed unasked.
  const users = await db.user.findMany({ select: { id: true } });
  await db.notification.createMany({
    data: users.map((x) => ({ userId: x.id, key: `update:${update.id}`, kind: "update", title: v.title, body: v.summary.slice(0, 300), href: "/updates" })),
    skipDuplicates: true,
  });
  await audit("update_published", user.id);
  revalidatePath("/review");
  revalidatePath("/updates");
  return { error: null };
}
