import Anthropic from '@anthropic-ai/sdk';

// Confirm this is still the current small/fast model id before relying on it long-term.
const MODEL = 'claude-haiku-4-5';
export const CLASSIFIER_VERSION = 1;

const VALID_TAGS = new Set(['needs_reply', 'urgent', 'action_item', 'newsletter']);

export async function classifyEmail(apiKey, { from, subject, snippet }) {
  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Classify this email for an executive assistant triaging the President's inbox. Respond with ONLY strict JSON, no prose: {"tags": string[], "reasoning": string}.

Valid tags: "needs_reply" (expects a direct response from her), "urgent" (time-sensitive, needs attention soon), "action_item" (requires her to do something, even if no reply needed), "newsletter" (bulk/promotional/informational content, not personally addressed).

An email can have zero, one, or multiple tags. If it's a newsletter, use only the "newsletter" tag.

From: ${from}
Subject: ${subject}
Snippet: ${snippet}`,
      },
    ],
  });

  const text = message.content?.[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t) => VALID_TAGS.has(t)) : [];

  return { tags, reasoning: parsed.reasoning || '' };
}
