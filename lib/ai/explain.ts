import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { RefusalResult } from "../engine/refusal";

/**
 * Optional plain-language explanation of a refusal letter by Claude.
 * Off unless the operator sets PRPATH_AI=on and Anthropic credentials are
 * available, and only used when the person ticks a separate consent box.
 * Claude never produces deadlines, legal references or recommendations:
 * those come from the deterministic analysis and are passed in as fixed facts.
 */
export function aiEnabled(): boolean {
  return process.env.PRPATH_AI === "on";
}

const SYSTEM = `You explain Canadian immigration refusal letters in plain, kind English for people with no legal background.
Rules:
- Use only what the letter says. If the letter doesn't say something, say it isn't stated.
- Explain each concern the officer raised, in the order they appear, in two or three sentences each, quoting the officer's own words briefly.
- Do not give legal advice or conclude whether the decision was right or wrong.
- Do not recommend reapplying, appealing or any other step; the app shows options separately.
- Do not state deadlines, section numbers or fees; the app shows those separately.
- If the letter mentions misrepresentation, criminality, security, a procedural fairness letter or leaving Canada, say clearly that a licensed consultant or lawyer should review it.
- Under 300 words. No headings. Short paragraphs.`;

export type AiExplanation = { ok: true; text: string; model: string } | { ok: false; reason: string };

export async function explainRefusal(letter: string, facts: RefusalResult): Promise<AiExplanation> {
  if (!aiEnabled()) return { ok: false, reason: "AI explanations are not turned on for this site." };
  const client = new Anthropic();
  const knownFacts = [
    `Application type identified by rules: ${facts.appType}.`,
    `Grounds found by rules: ${facts.grounds.map((g) => g.title).join("; ") || "none"}.`,
    `Flags found by rules: ${facts.flags.map((f) => f.title).join("; ") || "none"}.`,
  ].join("\n");
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `<letter>\n${letter.slice(0, 40_000)}\n</letter>` },
            { type: "text", text: `For context only (don't repeat as advice):\n${knownFacts}\n\nExplain the officer's concerns in this letter.` },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "The AI declined to explain this letter. The rule-based analysis above still applies." };
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return { ok: false, reason: "The AI returned no explanation." };
    return { ok: true, text, model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, reason: "AI explanations are misconfigured on this site." };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "The AI service is busy. Try again in a few minutes." };
    if (error instanceof Anthropic.APIError) return { ok: false, reason: "The AI service couldn't be reached." };
    return { ok: false, reason: "The AI service couldn't be reached." };
  }
}
