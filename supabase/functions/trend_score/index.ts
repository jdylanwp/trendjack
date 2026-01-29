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
}

interface TrendBucket {
  bucket_start: string;
  news_count: number;
}

interface ExecutionLog {
  timestamp: string;
  keyword: string;
  windowHours: number;
  current24hCount: number;
  baseline: number;
  heatScore: number;
  zScore: number;
  standardDeviation: number;
  isTrending: boolean;
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

    // Fetch all enabled keywords
    const { data: keywords, error: keywordsError } = await supabase
      .from("monitored_keywords")
      .select("id, keyword")
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

    const now = new Date();
    const windowHours = 24;

    // Process each keyword
    for (const keyword of keywords as MonitoredKeyword[]) {
      const log: ExecutionLog = {
        timestamp: new Date().toISOString(),
        keyword: keyword.keyword,
        windowHours,
        current24hCount: 0,
        baseline: 0,
        heatScore: 0,
        zScore: 0,
        standardDeviation: 0,
        isTrending: false,
        errors: [],
      };

      try {
        // Fetch last 7 days of trend buckets
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: buckets, error: bucketsError } = await supabase
          .from("trend_buckets")
          .select("bucket_start, news_count")
          .eq("keyword_id", keyword.id)
          .gte("bucket_start", sevenDaysAgo.toISOString())
          .order("bucket_start", { ascending: true });

        if (bucketsError) {
          log.errors.push(`Failed to fetch buckets: ${bucketsError.message}`);
          executionLogs.push(log);
          continue;
        }

        if (!buckets || buckets.length === 0) {
          log.errors.push("No historical data available");
          executionLogs.push(log);
          continue;
        }

        const typedBuckets = buckets as TrendBucket[];

        // Calculate current 24h count
        const twentyFourHoursAgo = new Date(now);
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - windowHours);

        const current24hBuckets = typedBuckets.filter((bucket) => {
          const bucketDate = new Date(bucket.bucket_start);
          return bucketDate >= twentyFourHoursAgo;
        });

        const current24hCount = current24hBuckets.reduce(
          (sum, bucket) => sum + bucket.news_count,
          0
        );
        log.current24hCount = current24hCount;

        // Calculate baseline (mean of all buckets)
        const totalCount = typedBuckets.reduce(
          (sum, bucket) => sum + bucket.news_count,
          0
        );
        const mean = totalCount / typedBuckets.length;
        log.baseline = parseFloat(mean.toFixed(2));

        // Calculate variance (how "noisy" is this keyword usually?)
        const variance = typedBuckets.reduce((sum, bucket) => {
          return sum + Math.pow(bucket.news_count - mean, 2);
        }, 0) / typedBuckets.length;

        // Calculate standard deviation (the "normal range")
        const stdDev = Math.sqrt(variance);
        log.standardDeviation = parseFloat(stdDev.toFixed(2));

        // Calculate Z-Score (the "explosive score")
        // Formula: (Current Volume - Average) / Volatility
        // If stdDev is 0 (flat line), Z-Score is 0
        const zScore = stdDev === 0 ? 0 : (current24hCount - mean) / stdDev;
        log.zScore = parseFloat(zScore.toFixed(2));

        // Calculate legacy heat score for backward compatibility
        const heatScore = (current24hCount - mean) / (mean + 1);
        log.heatScore = parseFloat(heatScore.toFixed(2));

        // Determine if trending using Z-Score
        // Z-Score > 1.5 = 86.6% confidence this is an anomaly
        // Z-Score > 1.96 = 95% confidence (Hockey Stick)
        const isTrending = zScore > 1.5 && current24hCount >= 5;
        log.isTrending = isTrending;

        // Insert trend score (idempotent with unique constraint on keyword_id, window_hours, date)
        const { error: insertError } = await supabase
          .from("trend_scores")
          .insert({
            keyword_id: keyword.id,
            window_hours: windowHours,
            heat_score: heatScore,
            z_score: zScore,
            standard_deviation: stdDev,
            baseline: {
              mean: mean,
              stdDev: stdDev,
              current24h: current24hCount,
              totalBuckets: typedBuckets.length,
              current24hBuckets: current24hBuckets.length,
            },
            is_trending: isTrending,
            calculated_at: now.toISOString(),
          });

        if (insertError && !insertError.message.includes("duplicate")) {
          log.errors.push(`Insert error: ${insertError.message}`);
        }
      } catch (error) {
        log.errors.push(`Processing error: ${error.message}`);
      }

      executionLogs.push(log);
    }

    const endTime = new Date().toISOString();
    const trendingKeywords = executionLogs.filter((log) => log.isTrending);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          keywordsProcessed: keywords.length,
          trendingKeywordsFound: trendingKeywords.length,
          trendingKeywords: trendingKeywords.map((log) => ({
            keyword: log.keyword,
            heatScore: log.heatScore,
            zScore: log.zScore,
            current24hCount: log.current24hCount,
          })),
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
