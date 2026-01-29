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
}

interface ExecutionLog {
  timestamp: string;
  subreddit: string;
  postsFetched: number;
  postsInserted: number;
  errors: string[];
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
        item: [
          ["link"],
          ["pubDate"],
          ["title"],
          ["content:encoded", "content"],
          ["description"],
          ["author"],
          ["category", "flair"],
        ],
      },
    });

    // Fetch all enabled keywords to get unique subreddits
    const { data: keywords, error: keywordsError } = await supabase
      .from("monitored_keywords")
      .select("id, keyword, related_subreddit")
      .eq("enabled", true);

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

    // Get unique subreddits
    const typedKeywords = keywords as MonitoredKeyword[];
    const uniqueSubreddits = [...new Set(typedKeywords.map((k) => k.related_subreddit))];

    // Process each subreddit
    for (const subreddit of uniqueSubreddits) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        subreddit,
        postsFetched: 0,
        postsInserted: 0,
        errors: [],
      };

      try {
        // Fetch Reddit RSS feed
        const rssUrl = `https://www.reddit.com/r/${subreddit}/new/.rss`;

        const feed = await parser.parseURL(rssUrl);
        log.postsFetched = feed.items.length;

        // Process each post
        const redditPosts = [];

        for (const item of feed.items) {
          const canonicalUrl = normalizeUrl(item.link || "");
          const urlHash = createUrlHash(canonicalUrl);

          // Extract content from Reddit RSS
          const content = item.content || item.description || "";
          const cleanContent = stripHtml(content);
          const truncatedBody = cleanContent.substring(0, 1000);

          // Extract author (Reddit format: /u/username)
          const author = extractAuthor(item.author || "");

          // Extract flair from category
          const flair = Array.isArray(item.flair) ? item.flair[0] : item.flair || null;

          // Parse published date
          const createdAt = new Date(item.pubDate || new Date());

          redditPosts.push({
            subreddit,
            canonical_url: canonicalUrl,
            url_hash: urlHash,
            title: item.title || "",
            body: truncatedBody,
            author,
            flair,
            created_at: createdAt.toISOString(),
            fetched_at: new Date().toISOString(),
            raw: item,
          });
        }

        // Insert Reddit posts (idempotent with ON CONFLICT DO NOTHING)
        if (redditPosts.length > 0) {
          const { error: insertError } = await supabase
            .from("reddit_posts")
            .insert(redditPosts);

          if (insertError && !insertError.message.includes("duplicate")) {
            log.errors.push(`Insert error: ${insertError.message}`);
          } else {
            log.postsInserted = redditPosts.length;
          }
        }
      } catch (error) {
        log.errors.push(`Processing error: ${error.message}`);
      }

      executionLogs.push(log);
    }

    const endTime = new Date().toISOString();
    const totalFetched = executionLogs.reduce((sum, log) => sum + log.postsFetched, 0);
    const totalInserted = executionLogs.reduce((sum, log) => sum + log.postsInserted, 0);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          subredditsProcessed: uniqueSubreddits.length,
          totalPostsFetched: totalFetched,
          totalPostsInserted: totalInserted,
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAuthor(authorString: string): string {
  // Reddit RSS format: "/u/username" or "u/username"
  const match = authorString.match(/\/?u\/([^\s]+)/);
  return match ? match[1] : authorString;
}
