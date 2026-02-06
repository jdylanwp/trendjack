import { createClient } from "npm:@supabase/supabase-js@2";
import type { Deps, RedditPost, AIResponse } from "./types.ts";

export function buildPrompt(
  post: RedditPost,
  keyword: string,
  offerContext: string,
  newsContext: string
): string {
  const businessContext = offerContext
    ? `\n\nYour Business Context (for reference when crafting workarounds):\n${offerContext}`
    : "";

  const trendingNews = newsContext
    ? `\n\nRECENT TRENDING NEWS about "${keyword}" (use this for situational awareness when crafting your reply — reference these events if relevant to the user's problem):\n${newsContext}`
    : "";

  return `Analyze this Reddit post for sales/marketing intent AND frustration level related to "${keyword}".

Post Title: ${post.title}
Post Body: ${post.body}
Subreddit: r/${post.subreddit}

Return JSON ONLY in this exact format:
{
  "intent_score": <number 0-100>,
  "pain_point": "<short summary of the user's problem>",
  "suggested_reply": "<The comment text to post on Reddit>",
  "fury_score": <number 0-100>,
  "pain_summary": "<brief explanation of what's causing frustration>",
  "primary_trigger": "<main frustration trigger, e.g., 'Expensive pricing tier changes'>",
  "sample_quote": "<direct quote from the post showing frustration>"
}

INTENT SCORE (0-100) based on:
- How clearly they express a problem or need
- How likely they are to be receptive to a solution
- How relevant their problem is to ${keyword}
Be strict - only score above 75 if there's clear buying intent or a specific problem to solve.

FURY SCORE (0-100) - The Pain-to-Solution Ratio:
- 0-30: Mild curiosity, no real frustration
- 30-60: Noticeable dissatisfaction, some pain points
- 60-80: High frustration, clear complaints about current solution
- 80-100: Extreme anger, urgency, desperation. Uses words like "hate", "stuck", "broken", "expensive", "terrible", "nightmare", "frustrated"

Look for emotional language indicating:
- Anger at current tools/services
- Desperation for alternatives
- Financial pain (too expensive, waste of money)
- Time/productivity loss
- Failed attempts to solve the problem
- Expletives or strong negative language

The fury_score should be HIGH when users are ready to switch NOW, not just browsing.

CRITICAL INSTRUCTIONS FOR "suggested_reply" (STRATEGIC INFILTRATION):

1. If fury_score is HIGH (>70): Use "Permission-Based DM" Strategy
   DO NOT mention product names, links, or pitch anything publicly
   Sympathize with their pain point authentically ("I dealt with this exact issue last month")
   Mention you found a workaround or solution that worked for you
   Keep it vague - don't explain the solution publicly
   End with a permission-based hook: "Mind if I DM you the steps?" or "Happy to share the workaround if you DM me"

   Example: "Ugh, I feel this. I was stuck in the same pricing trap with [their problem]. Found a workaround that cut my costs by 60% but it's not something I can post publicly. Mind if I DM you the approach?"

2. If fury_score is LOW (<70) but intent_score is HIGH (>80): Use "Helpful Expert" Strategy (90:10 Rule)
   DO NOT pitch products or services
   Give genuinely helpful, actionable advice that addresses their specific question
   Demonstrate expertise and credibility
   Build trust so they check your profile or ask follow-up questions
   Be a helpful community member FIRST

   Example: "Here's what worked for me: [specific actionable tip]. The key is [insight]. Also make sure you [additional tip]. Hope that helps!"

3. If both scores are LOW (<70): Use "Minimal Engagement" Strategy
   Short, empathetic comment that adds value
   OR skip the reply entirely (write "SKIP - Low priority lead")

   Example: "Good question, curious to see what others suggest." or "SKIP - Low priority lead"

REMEMBER: The goal is NOT to pitch. The goal is to get them to DM YOU by demonstrating value and creating curiosity. Angry users convert fastest when they feel like they discovered YOU, not the other way around.${businessContext}${trendingNews}`;
}

async function scorePostViaOpenRouter(
  post: RedditPost,
  keyword: string,
  apiKey: string,
  offerContext: string,
  newsContext: string
): Promise<AIResponse> {
  const prompt = buildPrompt(post, keyword, offerContext, newsContext);

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trendjack.app",
        "X-Title": "TrendJack",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-maverick",
        messages: [{ role: "user", content: prompt }],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content) as AIResponse;
}

export function createDeps(overrides?: Partial<Deps>): Deps {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

  if (!openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }

  return {
    supabase: createClient(supabaseUrl, supabaseServiceKey),
    openRouterApiKey,
    scorePost: scorePostViaOpenRouter,
    ...overrides,
  };
}
