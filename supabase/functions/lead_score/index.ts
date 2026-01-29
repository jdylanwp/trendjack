import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MonitoredKeyword {
  id: string;
  keyword: string;
  related_subreddit: string;
  user_id: string;
  last_processed_at: string | null;
}

interface RedditPost {
  id: string;
  subreddit: string;
  canonical_url: string;
  title: string;
  body: string;
  author: string;
  flair: string | null;
  created_at: string;
}

interface AIResponse {
  intent_score: number;
  pain_point: string;
  suggested_reply: string;
}

interface ExecutionLog {
  timestamp: string;
  keyword: string;
  postsAnalyzed: number;
  candidatesCreated: number;
  aiCallsMade: number;
  leadsCreated: number;
  errors: string[];
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const executionLogs: ExecutionLog[] = [];
  const startTime = new Date().toISOString();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    let batchSize = 10;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.batch_size) batchSize = body.batch_size;
      } catch {
        // Ignore JSON parse errors, use defaults
      }
    }

    // Fetch all enabled keywords with batching
    // Process oldest last_processed_at first to ensure fair rotation
    const { data: keywords, error: keywordsError } = await supabase
      .from("monitored_keywords")
      .select("id, keyword, related_subreddit, user_id, last_processed_at")
      .eq("enabled", true)
      .order("last_processed_at", { ascending: true, nullsFirst: true })
      .limit(batchSize);

    if (keywordsError) {
      throw new Error(`Failed to fetch monitored keywords: ${keywordsError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No enabled keywords found",
          executionLogs: [],
          startTime,
          endTime: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const monitoredKeywords: MonitoredKeyword[] = keywords as MonitoredKeyword[];

    // Process each monitored keyword
    for (const keyword of monitoredKeywords) {
      // Fetch user's offer context and limits
      const [settingsResult, limitsResult] = await Promise.all([
        supabase
          .from("user_settings")
          .select("offer_context")
          .eq("user_id", keyword.user_id)
          .maybeSingle(),
        supabase.rpc("get_user_tier_limits", { p_user_id: keyword.user_id })
      ]);

      const offerContext = settingsResult.data?.offer_context || "";
      const userLimits = limitsResult.data?.[0];

      if (!userLimits) {
        continue;
      }

      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        keyword: keyword.keyword,
        postsAnalyzed: 0,
        candidatesCreated: 0,
        aiCallsMade: 0,
        leadsCreated: 0,
        errors: [],
      };

      try {
        // Fetch recent Reddit posts from the last 48 hours
        const fortyEightHoursAgo = new Date();
        fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

        const { data: posts, error: postsError } = await supabase
          .from("reddit_posts")
          .select("*")
          .eq("subreddit", keyword.related_subreddit)
          .gte("created_at", fortyEightHoursAgo.toISOString())
          .order("created_at", { ascending: false });

        if (postsError) {
          log.errors.push(`Failed to fetch posts: ${postsError.message}`);
          executionLogs.push(log);
          continue;
        }

        if (!posts || posts.length === 0) {
          log.errors.push("No recent posts found");
          executionLogs.push(log);
          continue;
        }

        const typedPosts = posts as RedditPost[];
        log.postsAnalyzed = typedPosts.length;

        // Prefilter posts
        for (const post of typedPosts) {
          const reasons: string[] = [];

          // Check for question marks
          if (post.title.includes("?") || post.body.includes("?")) {
            reasons.push("contains_question");
          }

          // Check for intent phrases
          const combinedText = `${post.title} ${post.body}`.toLowerCase();
          const matchedPhrases = INTENT_PHRASES.filter((phrase) =>
            combinedText.includes(phrase)
          );
          if (matchedPhrases.length > 0) {
            reasons.push(`intent_phrases: ${matchedPhrases.join(", ")}`);
          }

          // Check for help/question flair
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

          // If post passes prefilter, create candidate and score with AI
          if (reasons.length > 0) {
            // Insert into lead_candidates (idempotent)
            const { error: candidateError } = await supabase
              .from("lead_candidates")
              .insert({
                user_id: keyword.user_id,
                keyword_id: keyword.id,
                reddit_post_id: post.id,
                reason: reasons.join("; "),
              });

            // CRITICAL: If duplicate, we already processed this post. SKIP to prevent cost leaks.
            if (candidateError && candidateError.message.includes("duplicate")) {
              continue;
            }

            // If other error, log it and skip
            if (candidateError) {
              log.errors.push(`Candidate insert error: ${candidateError.message}`);
              continue;
            }

            // NEW candidate created - proceed with AI scoring
            log.candidatesCreated++;

            // Check if lead already exists for this post AND this user
            const { data: existingLead } = await supabase
              .from("leads")
              .select("id")
              .eq("reddit_post_id", post.id)
              .eq("user_id", keyword.user_id)
              .maybeSingle();

            if (!existingLead) {
              // Check if user has reached their AI analysis limit
              if (userLimits.current_ai_analyses >= userLimits.max_ai_analyses_per_month) {
                log.errors.push(`AI analysis limit reached for user ${keyword.user_id}`);
                continue;
              }

              // Check if user has reached their leads limit
              if (userLimits.current_leads >= userLimits.max_leads_per_month) {
                log.errors.push(`Leads limit reached for user ${keyword.user_id}`);
                continue;
              }

              // Call AI to score the post
              try {
                const aiResponse = await scorePostWithAI(
                  post,
                  keyword.keyword,
                  openRouterApiKey,
                  offerContext
                );
                log.aiCallsMade++;

                // Increment AI analysis usage
                await supabase.rpc("increment_usage", {
                  p_usage_type: "ai_analysis",
                  p_user_id: keyword.user_id,
                });

                // Refresh limits after AI call
                const { data: updatedLimits } = await supabase.rpc("get_user_tier_limits", {
                  p_user_id: keyword.user_id,
                });
                if (updatedLimits?.[0]) {
                  Object.assign(userLimits, updatedLimits[0]);
                }

                // Only save if intent score is high enough
                if (aiResponse.intent_score >= 75) {
                  const { error: leadError } = await supabase
                    .from("leads")
                    .insert({
                      user_id: keyword.user_id,
                      keyword_id: keyword.id,
                      reddit_post_id: post.id,
                      intent_score: aiResponse.intent_score,
                      pain_point: aiResponse.pain_point,
                      suggested_reply: aiResponse.suggested_reply,
                      ai_analysis: aiResponse,
                      status: "new",
                    });

                  if (!leadError || leadError.message.includes("duplicate")) {
                    log.leadsCreated++;

                    // Increment leads usage
                    await supabase.rpc("increment_usage", {
                      p_usage_type: "lead",
                      p_user_id: keyword.user_id,
                    });

                    // Refresh limits after lead creation
                    const { data: finalLimits } = await supabase.rpc("get_user_tier_limits", {
                      p_user_id: keyword.user_id,
                    });
                    if (finalLimits?.[0]) {
                      Object.assign(userLimits, finalLimits[0]);
                    }
                  } else {
                    log.errors.push(`Lead insert error: ${leadError.message}`);
                  }
                }
              } catch (aiError) {
                log.errors.push(`AI scoring error: ${aiError.message}`);
              }
            }
          }
        }
      } catch (error) {
        log.errors.push(`Processing error: ${error.message}`);
      }

      // Update last_processed_at for batching rotation
      await supabase
        .from("monitored_keywords")
        .update({ last_processed_at: new Date().toISOString() })
        .eq("id", keyword.id);

      executionLogs.push(log);
    }

    const endTime = new Date().toISOString();
    const totalCandidates = executionLogs.reduce((sum, log) => sum + log.candidatesCreated, 0);
    const totalAICalls = executionLogs.reduce((sum, log) => sum + log.aiCallsMade, 0);
    const totalLeads = executionLogs.reduce((sum, log) => sum + log.leadsCreated, 0);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          keywordsProcessed: monitoredKeywords.length,
          totalCandidatesCreated: totalCandidates,
          totalAICallsMade: totalAICalls,
          totalLeadsCreated: totalLeads,
        },
        executionLogs,
        startTime,
        endTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        executionLogs,
        startTime,
        endTime: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function scorePostWithAI(
  post: RedditPost,
  keyword: string,
  apiKey: string,
  offerContext: string
): Promise<AIResponse> {
  const contextInstruction = offerContext
    ? `\n\nDraft the reply as if you are the user described below. Subtly mention how your specific service solves their pain point. Be helpful first, promotional second.\n\nYour Business Context:\n${offerContext}`
    : `\n\nDraft a helpful, non-spammy reply that addresses their specific problem.`;

  const prompt = `Analyze this Reddit post for sales/marketing intent related to "${keyword}".

Post Title: ${post.title}
Post Body: ${post.body}
Subreddit: r/${post.subreddit}

Return JSON ONLY in this exact format:
{
  "intent_score": <number 0-100>,
  "pain_point": "<short summary of the user's problem>",
  "suggested_reply": "<helpful reply that subtly pitches your service>"
}

Score 0-100 based on:
- How clearly they express a problem or need
- How likely they are to be receptive to a solution
- How relevant their problem is to ${keyword}

Be strict - only score above 75 if there's clear buying intent or a specific problem to solve.${contextInstruction}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://trendjack.app",
      "X-Title": "TrendJack",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const aiResponse = JSON.parse(content) as AIResponse;

  return aiResponse;
}
