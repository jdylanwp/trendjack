import type { RedditPost, FilteredCandidate, MonitoredKeyword } from "./types.ts";

const INTENT_PHRASES = [
  "looking for",
  "recommend",
  "anyone used",
  "suggestions",
  "advice",
  "help me",
  "what should",
  "how do i",
  "best way",
  "need help",
  "any tips",
  "struggling with",
];

function detectReasons(post: RedditPost): string[] {
  const reasons: string[] = [];

  if (post.title.includes("?") || post.body.includes("?")) {
    reasons.push("contains_question");
  }

  const combinedText = `${post.title} ${post.body}`.toLowerCase();
  const matchedPhrases = INTENT_PHRASES.filter((phrase) =>
    combinedText.includes(phrase)
  );
  if (matchedPhrases.length > 0) {
    reasons.push(`intent_phrases: ${matchedPhrases.join(", ")}`);
  }

  if (post.flair) {
    const flairLower = post.flair.toLowerCase();
    if (
      flairLower.includes("help") ||
      flairLower.includes("question") ||
      flairLower.includes("advice")
    ) {
      reasons.push("help_question_flair");
    }
  }

  return reasons;
}

export function filterPosts(
  posts: RedditPost[],
  keyword: MonitoredKeyword
): FilteredCandidate[] {
  const candidates: FilteredCandidate[] = [];

  for (const post of posts) {
    const reasons = detectReasons(post);
    if (reasons.length > 0) {
      candidates.push({ post, keyword, reasons });
    }
  }

  return candidates;
}
