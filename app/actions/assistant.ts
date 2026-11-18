"use server";

import { z } from "zod";
import { audit, requireUser } from "@/lib/auth";
import { askAssistant, type AssistantReply } from "@/lib/ai/assistant";
import { loadProfile } from "@/lib/profile/store";

const turns = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
  .min(1)
  .max(24)
  .refine((t) => t[0].role === "user" && t[t.length - 1].role === "user", "The conversation must start and end with your question.");

export async function askAssistantAction(history: unknown, consent: boolean): Promise<AssistantReply> {
  const user = await requireUser();
  if (!consent) return { ok: false, reason: "Please confirm you agree to send your question and results summary to the AI service." };
  const parsed = turns.safeParse(history);
  if (!parsed.success) return { ok: false, reason: "Ask a shorter question (up to 4,000 characters), or start a new conversation." };
  const { profile } = await loadProfile(user.id);
  await audit("assistant_question", user.id);
  return askAssistant(profile, parsed.data);
}
