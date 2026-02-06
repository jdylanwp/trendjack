import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  entity_id?: string;
  trend_keyword: string;
  platform: "linkedin" | "twitter" | "reddit";
  content_type: "thought_leadership" | "hot_take" | "educational";
  user_id: string;
}

interface GeneratedContent {
  title: string;
  hook: string;
  body: string;
  cta: string;
}

function buildContentPrompt(
  trendKeyword: string,
  platform: string,
  contentType: string,
  newsHeadlines: string,
  offerContext: string,
  trendStatus: string
): string {
  const platformGuidance: Record<string, string> = {
    linkedin: `Platform: LinkedIn
- Professional, authoritative tone
- 1200-1500 characters max
- Use line breaks generously for readability
- Start with a bold hook (question, contrarian take, or surprising stat)
- End with a thought-provoking question to drive comments
- Use 3-5 relevant hashtags at the end`,
    twitter: `Platform: X (Twitter)
- Punchy, conversational tone
- 280 characters max for the main post
- Create a thread-worthy opening that makes people click "Show more"
- Use short sentences, each on its own line
- No hashtags in the main text, add 1-2 at the end only`,
    reddit: `Platform: Reddit
- Authentic, community-first tone
- Write as a fellow community member, NOT a marketer
- Share genuine insights and personal experience
- Never sound like an ad or press release
- Ask the community for their perspective at the end`,
  };

  const typeGuidance: Record<string, string> = {
    thought_leadership: `Style: Thought Leadership
- Position the author as someone who sees around corners
- Reference the news but add a non-obvious insight
- Make a prediction others haven't made yet
- "Here's what everyone is missing about X..."`,
    hot_take: `Style: Hot Take
- Contrarian or provocative angle
- Challenge the mainstream narrative
- Be bold but back it up with reasoning
- "Unpopular opinion: X is actually good/bad because..."`,
    educational: `Style: Educational
- Break down the trend for a non-expert audience
- Use analogies and simple language
- Provide actionable takeaways
- "Here's what X means for your business in 60 seconds..."`,
  };

  return `You are a viral content strategist. Generate a ${contentType} post about "${trendKeyword}" for ${platform}.

${platformGuidance[platform] || platformGuidance.linkedin}

${typeGuidance[contentType] || typeGuidance.thought_leadership}

Trend Status: ${trendStatus} (use this to calibrate urgency)

Recent News Context (the real-world events driving this trend):
${newsHeadlines || "No specific news available - use general industry knowledge"}

Author's Business Context (weave this in subtly, never pitch directly):
${offerContext || "General SaaS/tech professional"}

Return JSON ONLY in this exact format:
{
  "title": "<internal title for the draft, not published>",
  "hook": "<the first line/sentence that stops the scroll>",
  "body": "<the full post content, including the hook>",
  "cta": "<the closing call-to-action or question>"
}

CRITICAL RULES:
- The content must feel native to the platform, not like marketing copy
- Reference the specific news events to prove timeliness
- The author's product/service should NEVER be mentioned explicitly
- The CTA should drive engagement (comments, saves, shares), not clicks
- Write as a human with opinions, not a brand with talking points`;
}

async function fetchNewsForTrend(
  supabase: ReturnType<typeof createClient>,
  keyword: string
): Promise<string> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const { data: newsItems } = await supabase
    .from("news_items")
    .select("title, published_at")
    .ilike("title", `%${keyword}%`)
    .gte("published_at", cutoff.toISOString())
    .order("published_at", { ascending: false })
    .limit(8);

  if (!newsItems || newsItems.length === 0) return "";

  return newsItems
    .map(
      (item: { title: string; published_at: string }, i: number) =>
        `${i + 1}. ${item.title} (${new Date(item.published_at).toLocaleDateString()})`
    )
    .join("\n");
}

async function fetchEntityInfo(
  supabase: ReturnType<typeof createClient>,
  entityId: string
): Promise<{ trend_status: string; category: string } | null> {
  const { data } = await supabase
    .from("global_entities")
    .select("trend_status, category")
    .eq("id", entityId)
    .maybeSingle();

  return data;
}

async function fetchOfferContext(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("user_settings")
    .select("offer_context")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.offer_context || "";
}

async function generateContent(
  prompt: string,
  apiKey: string
): Promise<GeneratedContent> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://trendjack.app",
        "X-Title": "TrendJack Content Engine",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-maverick",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON in AI response");
  }

  return JSON.parse(jsonMatch[0]) as GeneratedContent;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: GenerateRequest = await req.json();
    const { entity_id, trend_keyword, platform, content_type, user_id } = body;

    if (!trend_keyword || !platform || !content_type || !user_id) {
      return new Response(
        JSON.stringify({
          error: "trend_keyword, platform, content_type, and user_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const [newsHeadlines, offerContext, entityInfo] = await Promise.all([
      fetchNewsForTrend(supabase, trend_keyword),
      fetchOfferContext(supabase, user_id),
      entity_id
        ? fetchEntityInfo(supabase, entity_id)
        : Promise.resolve(null),
    ]);

    const trendStatus = entityInfo?.trend_status || "Trending";

    const prompt = buildContentPrompt(
      trend_keyword,
      platform,
      content_type,
      newsHeadlines,
      offerContext,
      trendStatus
    );

    const generated = await generateContent(prompt, openRouterApiKey);

    const { data: draft, error: insertError } = await supabase
      .from("content_drafts")
      .insert({
        user_id,
        entity_id: entity_id || null,
        trend_keyword,
        platform,
        content_type,
        title: generated.title,
        body: generated.body,
        news_context: newsHeadlines,
        hook: generated.hook,
        cta: generated.cta,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to save draft: ${insertError.message}`);
    }

    await supabase.rpc("increment_usage", {
      p_usage_type: "ai_analysis",
      p_user_id: user_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        draft_id: draft.id,
        content: generated,
        news_context: newsHeadlines,
        trend_status: trendStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Content generation error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
