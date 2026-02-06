import type {
  Deps,
  MonitoredKeyword,
  RedditPost,
  UserContext,
  FilteredCandidate,
  ScoredLead,
  KeywordLog,
  PipelineResult,
} from "./types.ts";
import { filterPosts } from "./filter.ts";
import { scoreCandidates } from "./scorer.ts";

const INTENT_THRESHOLD = 75;
const LOOKBACK_HOURS = 48;
const SEMANTIC_THRESHOLD = 0.65;
const SEMANTIC_MAX_RESULTS = 15;

async function fetchKeywords(
  deps: Deps,
  batchSize: number
): Promise<MonitoredKeyword[]> {
  const { data, error } = await deps.supabase
    .from("monitored_keywords")
    .select("id, keyword, related_subreddit, user_id, last_processed_at")
    .eq("enabled", true)
    .order("last_processed_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);

  if (error) {
    throw new Error(`Failed to fetch monitored keywords: ${error.message}`);
  }

  return (data ?? []) as MonitoredKeyword[];
}

async function fetchUserContext(
  deps: Deps,
  userId: string
): Promise<UserContext | null> {
  const [settingsResult, limitsResult] = await Promise.all([
    deps.supabase
      .from("user_settings")
      .select("offer_context")
      .eq("user_id", userId)
      .maybeSingle(),
    deps.supabase.rpc("get_user_tier_limits", { p_user_id: userId }),
  ]);

  const userLimits = limitsResult.data?.[0];
  if (!userLimits) {
    return null;
  }

  return {
    offerContext: settingsResult.data?.offer_context ?? "",
    limits: userLimits,
  };
}

async function fetchRecentPosts(
  deps: Deps,
  subreddit: string
): Promise<RedditPost[]> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - LOOKBACK_HOURS);

  const { data, error } = await deps.supabase
    .from("reddit_posts")
    .select("*")
    .eq("subreddit", subreddit)
    .gte("created_at", cutoff.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch posts: ${error.message}`);
  }

  return (data ?? []) as RedditPost[];
}

async function fetchSemanticCandidates(
  deps: Deps,
  keyword: MonitoredKeyword,
  existingPostIds: Set<string>
): Promise<FilteredCandidate[]> {
  try {
    const model = new Supabase.ai.Session("gte-small");
    const queryText = `${keyword.keyword} looking for help recommendations alternatives frustration`;
    const queryEmbedding = await model.run(queryText, {
      mean_pool: true,
      normalize: true,
    });

    const embedding = Array.from(queryEmbedding as Float32Array);

    const { data: matches, error } = await deps.supabase.rpc(
      "match_posts_semantic",
      {
        query_embedding: embedding,
        match_threshold: SEMANTIC_THRESHOLD,
        match_count: SEMANTIC_MAX_RESULTS,
      }
    );

    if (error || !matches || matches.length === 0) {
      return [];
    }

    const newPostIds = matches
      .map((m: { reddit_post_id: string }) => m.reddit_post_id)
      .filter((id: string) => !existingPostIds.has(id));

    if (newPostIds.length === 0) return [];

    const { data: posts, error: postError } = await deps.supabase
      .from("reddit_posts")
      .select("*")
      .in("id", newPostIds);

    if (postError || !posts) return [];

    return (posts as RedditPost[]).map((post) => ({
      post,
      keyword,
      reasons: ["semantic_match"],
    }));
  } catch {
    return [];
  }
}

async function fetchNewsContext(
  deps: Deps,
  keyword: string
): Promise<string> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);

    const { data: newsItems } = await deps.supabase
      .from("news_items")
      .select("title, published_at")
      .ilike("title", `%${keyword}%`)
      .gte("published_at", cutoff.toISOString())
      .order("published_at", { ascending: false })
      .limit(5);

    if (!newsItems || newsItems.length === 0) return "";

    return newsItems
      .map(
        (item: { title: string; published_at: string }, i: number) =>
          `${i + 1}. ${item.title} (${new Date(item.published_at).toLocaleDateString()})`
      )
      .join("\n");
  } catch {
    return "";
  }
}

async function deduplicateCandidates(
  deps: Deps,
  candidates: FilteredCandidate[]
): Promise<FilteredCandidate[]> {
  const novel: FilteredCandidate[] = [];

  for (const candidate of candidates) {
    const { error } = await deps.supabase.from("lead_candidates").insert({
      user_id: candidate.keyword.user_id,
      keyword_id: candidate.keyword.id,
      reddit_post_id: candidate.post.id,
      reason: candidate.reasons.join("; "),
    });

    if (error && error.message.includes("duplicate")) {
      continue;
    }

    if (error) {
      throw new Error(`Candidate insert error: ${error.message}`);
    }

    novel.push(candidate);
  }

  return novel;
}

async function persistLeads(
  deps: Deps,
  leads: ScoredLead[]
): Promise<{ created: number; errors: string[] }> {
  let created = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    if (lead.aiResponse.intent_score < INTENT_THRESHOLD) {
      continue;
    }

    const kw = lead.candidate.keyword;

    const { data: existing } = await deps.supabase
      .from("leads")
      .select("id")
      .eq("reddit_post_id", lead.candidate.post.id)
      .eq("user_id", kw.user_id)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error: leadError } = await deps.supabase.from("leads").insert({
      user_id: kw.user_id,
      keyword_id: kw.id,
      reddit_post_id: lead.candidate.post.id,
      intent_score: lead.aiResponse.intent_score,
      pain_point: lead.aiResponse.pain_point,
      suggested_reply: lead.aiResponse.suggested_reply,
      fury_score: lead.aiResponse.fury_score ?? 0,
      pain_summary: lead.aiResponse.pain_summary ?? "",
      primary_trigger: lead.aiResponse.primary_trigger ?? "",
      sample_quote: lead.aiResponse.sample_quote ?? "",
      ai_analysis: lead.aiResponse,
      status: "new",
    });

    if (leadError && !leadError.message.includes("duplicate")) {
      errors.push(`Lead insert error: ${leadError.message}`);
      continue;
    }

    created++;
    await deps.supabase.rpc("increment_usage", {
      p_usage_type: "lead",
      p_user_id: kw.user_id,
    });
  }

  return { created, errors };
}

async function processKeyword(
  deps: Deps,
  keyword: MonitoredKeyword
): Promise<KeywordLog> {
  const log: KeywordLog = {
    timestamp: new Date().toISOString(),
    keyword: keyword.keyword,
    postsAnalyzed: 0,
    postsSemanticMatched: 0,
    candidatesCreated: 0,
    aiCallsMade: 0,
    leadsCreated: 0,
    errors: [],
  };

  try {
    const userCtx = await fetchUserContext(deps, keyword.user_id);
    if (!userCtx) {
      log.errors.push("User tier limits not found");
      return log;
    }

    const posts = await fetchRecentPosts(deps, keyword.related_subreddit);
    log.postsAnalyzed = posts.length;

    const regexFiltered = filterPosts(posts, keyword);

    const regexPostIds = new Set(regexFiltered.map((c) => c.post.id));
    const semanticCandidates = await fetchSemanticCandidates(
      deps,
      keyword,
      regexPostIds
    );
    log.postsSemanticMatched = semanticCandidates.length;

    const allCandidates = [...regexFiltered, ...semanticCandidates];

    if (allCandidates.length === 0) {
      return log;
    }

    const novel = await deduplicateCandidates(deps, allCandidates);
    log.candidatesCreated = novel.length;

    if (novel.length === 0) {
      return log;
    }

    if (
      userCtx.limits.current_leads >= userCtx.limits.max_leads_per_month
    ) {
      log.errors.push("Leads limit reached");
      return log;
    }

    const newsContext = await fetchNewsContext(deps, keyword.keyword);

    const scoreResult = await scoreCandidates(
      novel,
      deps,
      userCtx.offerContext,
      userCtx.limits,
      newsContext
    );
    log.aiCallsMade = scoreResult.aiCallsMade;
    log.errors.push(...scoreResult.errors);

    for (let i = 0; i < scoreResult.aiCallsMade; i++) {
      await deps.supabase.rpc("increment_usage", {
        p_usage_type: "ai_analysis",
        p_user_id: keyword.user_id,
      });
    }

    const persisted = await persistLeads(deps, scoreResult.scored);
    log.leadsCreated = persisted.created;
    log.errors.push(...persisted.errors);
  } catch (err) {
    log.errors.push(`Processing error: ${(err as Error).message}`);
  }

  await deps.supabase
    .from("monitored_keywords")
    .update({ last_processed_at: new Date().toISOString() })
    .eq("id", keyword.id);

  return log;
}

export async function runPipeline(
  deps: Deps,
  batchSize: number
): Promise<PipelineResult> {
  const startTime = new Date().toISOString();
  const logs: KeywordLog[] = [];

  try {
    const keywords = await fetchKeywords(deps, batchSize);

    if (keywords.length === 0) {
      return {
        success: true,
        summary: {
          keywordsProcessed: 0,
          totalCandidatesCreated: 0,
          totalAICallsMade: 0,
          totalLeadsCreated: 0,
        },
        logs: [],
        startTime,
        endTime: new Date().toISOString(),
      };
    }

    for (const keyword of keywords) {
      const log = await processKeyword(deps, keyword);
      logs.push(log);
    }

    return {
      success: true,
      summary: {
        keywordsProcessed: keywords.length,
        totalCandidatesCreated: logs.reduce(
          (s, l) => s + l.candidatesCreated,
          0
        ),
        totalAICallsMade: logs.reduce((s, l) => s + l.aiCallsMade, 0),
        totalLeadsCreated: logs.reduce((s, l) => s + l.leadsCreated, 0),
      },
      logs,
      startTime,
      endTime: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      summary: {
        keywordsProcessed: 0,
        totalCandidatesCreated: 0,
        totalAICallsMade: 0,
        totalLeadsCreated: 0,
      },
      logs,
      startTime,
      endTime: new Date().toISOString(),
      error: (err as Error).message,
    };
  }
}
