"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, currentUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptJson } from "@/lib/crypto";
import { analyzeRefusal, type RefusalResult } from "@/lib/engine/refusal";
import { explainRefusal, type AiExplanation } from "@/lib/ai/explain";
import { getDocumentMeta } from "@/lib/documents/store";

const input = z.object({
  text: z.string().max(50_000).optional(),
  documentId: z.string().max(40).optional(),
  notifiedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  where: z.enum(["in_canada", "outside_canada", "unknown"]),
  ai: z.boolean(),
  save: z.boolean(),
});

export interface RefusalResponse {
  error: string | null;
  result: RefusalResult | null;
  ai: AiExplanation | null;
  savedId: string | null;
}

export async function analyzeRefusalAction(raw: z.infer<typeof input>): Promise<RefusalResponse> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Check the form and try again.", result: null, ai: null, savedId: null };
  const v = parsed.data;
  const user = await currentUser();

  let text = v.text ?? "";
  let documentId: string | null = null;
  if (v.documentId) {
    if (!user) return { error: "Sign in to analyze an uploaded document.", result: null, ai: null, savedId: null };
    const doc = await getDocumentMeta(user.id, v.documentId);
    if (!doc) return { error: "Document not found.", result: null, ai: null, savedId: null };
    if (!doc.meta.text) return { error: "We couldn't read text from that file. Paste the letter's text instead.", result: null, ai: null, savedId: null };
    text = doc.meta.text;
    documentId = doc.id;
  }
  if (text.trim().length < 40) return { error: "Paste the full letter, including the part with the officer's reasons.", result: null, ai: null, savedId: null };

  const result = analyzeRefusal({ text, notifiedOn: v.notifiedOn || undefined, where: v.where }, new Date());
  const ai = v.ai && user ? await explainRefusal(text, result) : null;

  let savedId: string | null = null;
  if (user && v.save) {
    const row = await db.refusalAnalysis.create({
      data: { userId: user.id, documentId, cipher: encryptJson({ text, notifiedOn: v.notifiedOn, where: v.where, result, ai }) },
      select: { id: true },
    });
    savedId = row.id;
    await audit("refusal_analyzed", user.id);
    revalidatePath("/refusal");
  }
  return { error: null, result, ai, savedId };
}

export async function deleteRefusalAction(id: string) {
  const user = await requireUser();
  await db.refusalAnalysis.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/refusal");
}
