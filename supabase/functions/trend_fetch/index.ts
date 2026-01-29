import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Parser from "npm:rss-parser@3";
import { createHash } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MonitoredKeyword {
  id: string;
  keyword: string;
  related_subreddit: string;
  enabled: boolean;
}

interface ExecutionLog {
  timestamp: string;
  keyword: string;
  newsItemsFetched: number;
  newsItemsInserted: number;
  bucketsUpdated: number;
  topicsDiscovered: number;
  globalEntitiesExtracted: number;
  errors: string[];
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "is", "are", "was", "were", "be", "this", "that", "new", "how", "why", "what",
  "top", "best", "vs", "review", "guide", "2024", "2025", "2026", "daily", "weekly",
  "about", "from", "says", "after", "over", "more", "than", "into", "here", "when"
]);

function extractTopics(text: string): string[] {
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
  return cleanText.split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, 10);
}

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const parser = new Parser({
      customFields: {
        item: ["link", "pubDate", "title", "description"],
      },
    });

    // Parse request body for optional parameters
    let batchSize = 50;
    let specificKeywordId = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.batch_size) batchSize = body.batch_size;
        if (body.keyword_id) specificKeywordId = body.keyword_id;
      } catch {
        // Ignore JSON parse errors, use defaults
      }
    }

    // Fetch enabled keywords with batching
    // Order by last_fetched_at to process least recently updated first
    let query = supabase
      .from("monitored_keywords")
      .select("*")
      .eq("enabled", true)
      .order("last_fetched_at", { ascending: true });

    if (specificKeywordId) {
      query = query.eq("id", specificKeywordId).limit(1);
    } else {
      query = query.limit(batchSize);
    }

    const { data: keywords, error: keywordsError } = await query;

    if (keywordsError) {
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
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

    // Process each keyword
    for (const keyword of keywords as MonitoredKeyword[]) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        keyword: keyword.keyword,
        newsItemsFetched: 0,
        newsItemsInserted: 0,
        bucketsUpdated: 0,
        topicsDiscovered: 0,
        globalEntitiesExtracted: 0,
        errors: [],
      };

      try {
        // Fetch Google News RSS
        const searchQuery = encodeURIComponent(keyword.keyword);
        const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en`;

        const feed = await parser.parseURL(rssUrl);
        log.newsItemsFetched = feed.items.length;

        // Process each news item
        const newsItems = [];
        const bucketCounts = new Map<string, number>();
        const discoveredTopics = new Set<string>();

        for (const item of feed.items) {
          const canonicalUrl = normalizeUrl(item.link || "");
          const urlHash = createUrlHash(canonicalUrl);
          const publishedAt = new Date(item.pubDate || new Date());

          newsItems.push({
            keyword_id: keyword.id,
            canonical_url: canonicalUrl,
            url_hash: urlHash,
            title: item.title || "",
            published_at: publishedAt.toISOString(),
            fetched_at: new Date().toISOString(),
            raw: item,
          });

          // Calculate hourly bucket
          const bucketStart = new Date(publishedAt);
          bucketStart.setMinutes(0, 0, 0);
          const bucketKey = bucketStart.toISOString();

          bucketCounts.set(bucketKey, (bucketCounts.get(bucketKey) || 0) + 1);

          // Legacy: Extract simple topics for backward compatibility
          const potentialTopics = extractTopics(item.title || "");
          potentialTopics.forEach(topic => {
            if (topic !== keyword.keyword.toLowerCase()) {
              discoveredTopics.add(topic);
            }
          });
        }

        // Store discovered topics (fire-and-forget for performance)
        if (discoveredTopics.size > 0) {
          const topicPromises = Array.from(discoveredTopics).map(topic =>
            supabase.rpc('upsert_related_topic', {
              p_keyword_id: keyword.id,
              p_topic: topic
            })
          );

          Promise.allSettled(topicPromises).then(results => {
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            log.topicsDiscovered = successCount;
          });
        }

        // NEW: AI-powered entity extraction for global trend platform
        if (newsItems.length > 0) {
          const titles = newsItems.map(item => item.title).filter(t => t.length > 10);

          if (titles.length >= 5) {
            try {
              const entityExtractUrl = `${supabaseUrl}/functions/v1/entity_extract`;
              const entityResponse = await fetch(entityExtractUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  titles: titles,
                  source: "news",
                  batch_size: 20,
                }),
              });

              if (entityResponse.ok) {
                const entityData = await entityResponse.json();
                log.globalEntitiesExtracted = entityData.extracted || 0;
              }
            } catch (entityError) {
              log.errors.push(`Entity extraction failed: ${entityError.message}`);
            }
          }
        }

        // Insert news items (idempotent with ON CONFLICT DO NOTHING)
        if (newsItems.length > 0) {
          const { error: insertError } = await supabase
            .from("news_items")
            .insert(newsItems);

          if (insertError && !insertError.message.includes("duplicate")) {
            log.errors.push(`Insert error: ${insertError.message}`);
          } else {
            log.newsItemsInserted = newsItems.length;
          }
        }

        // Upsert trend buckets
        for (const [bucketStart, count] of bucketCounts.entries()) {
          const { error: upsertError } = await supabase
            .from("trend_buckets")
            .upsert(
              {
                keyword_id: keyword.id,
                bucket_start: bucketStart,
                news_count: count,
              },
              {
                onConflict: "keyword_id,bucket_start",
              }
            );

          if (upsertError) {
            log.errors.push(`Bucket upsert error: ${upsertError.message}`);
          } else {
            log.bucketsUpdated++;
          }
        }

        // Update last_fetched_at for batching rotation
        await supabase
          .from("monitored_keywords")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", keyword.id);
      } catch (error) {
        log.errors.push(`Processing error: ${error.message}`);
      }

      executionLogs.push(log);
    }

    const endTime = new Date().toISOString();
    const totalFetched = executionLogs.reduce((sum, log) => sum + log.newsItemsFetched, 0);
    const totalInserted = executionLogs.reduce((sum, log) => sum + log.newsItemsInserted, 0);
    const totalBuckets = executionLogs.reduce((sum, log) => sum + log.bucketsUpdated, 0);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          keywordsProcessed: keywords.length,
          totalNewsItemsFetched: totalFetched,
          totalNewsItemsInserted: totalInserted,
          totalBucketsUpdated: totalBuckets,
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

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

function createUrlHash(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}
